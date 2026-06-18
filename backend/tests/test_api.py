import os
import tempfile
import unittest
from pathlib import Path

import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import database, main
from app.schemas import AiChatIn, ContactCreate, GoogleLoginIn, GroupContactLinkIn, GroupCreate, GroupMemberCreate, UserCreate


def contact_payload(**overrides):
    payload = {
        "owner_id": "test-user",
        "name": "Aline Prado",
        "phone": "11 90000-1111",
        "service": "designer de site",
        "note": "",
        "city": "Sao Paulo",
        "address": "Sao Paulo, SP",
        "trust": "Novo",
        "source": "Manual",
        "next_follow_up_at": "",
    }
    payload.update(overrides)
    return ContactCreate(**payload)


class NetworkAgendaApiTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        database.DATA_DIR = Path(self.tmpdir.name)
        database.DB_PATH = database.DATA_DIR / "network_agenda_test.sqlite3"
        os.environ.pop("DATABASE_URL", None)
        os.environ.pop("OPENAI_API_KEY", None)
        database.init_db()

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_health(self):
        self.assertEqual(main.health()["status"], "ok")

    def test_postgres_sql_translation(self):
        sql = database.to_postgres_sql("SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC")

        self.assertEqual(sql, "SELECT * FROM contacts WHERE owner_id = %s ORDER BY created_at DESC")

    def test_cors_origins_include_configured_domains(self):
        os.environ["CORS_ALLOWED_ORIGINS"] = "https://agenda.example.com, https://agenda.example.com/"
        try:
            origins = main.cors_allowed_origins()
        finally:
            os.environ.pop("CORS_ALLOWED_ORIGINS", None)

        self.assertIn("http://127.0.0.1:5174", origins)
        self.assertEqual(origins.count("https://agenda.example.com"), 1)

    def test_contacts_are_scoped_by_owner(self):
        main.create_contact(contact_payload(owner_id="owner-a", name="Ana Silva", phone="11 90000-2222"))
        main.create_contact(contact_payload(owner_id="owner-b", name="Bia Souza", phone="11 90000-3333"))

        owner_a_contacts = main.contacts(query="", category="all", user_id="owner-a")

        self.assertEqual([contact["name"] for contact in owner_a_contacts], ["Ana Silva"])

    def test_follow_up_conflict_blocks_same_owner_slot_on_create(self):
        slot = "2026-07-01T10:00:30"
        main.create_contact(contact_payload(owner_id="owner-a", name="Ana Silva", phone="11 90000-2222", next_follow_up_at=slot))

        with self.assertRaises(HTTPException) as raised:
            main.create_contact(contact_payload(owner_id="owner-a", name="Bia Souza", phone="11 90000-3333", next_follow_up_at="2026-07-01T10:00:45"))

        self.assertEqual(raised.exception.status_code, 409)

    def test_follow_up_conflict_blocks_same_owner_slot_on_update(self):
        slot = "2026-07-01T10:00:30"
        main.create_contact(contact_payload(owner_id="owner-a", name="Ana Silva", phone="11 90000-2222", next_follow_up_at=slot))
        editable = main.create_contact(contact_payload(owner_id="owner-a", name="Bia Souza", phone="11 90000-3333", next_follow_up_at="2026-07-01T11:00"))

        with self.assertRaises(HTTPException) as raised:
            main.edit_contact(
                editable["id"],
                contact_payload(owner_id="owner-a", name="Bia Souza", phone="11 90000-3333", next_follow_up_at="2026-07-01T10:00:45"),
            )

        self.assertEqual(raised.exception.status_code, 409)

    def test_follow_up_slot_can_repeat_across_different_owners(self):
        slot = "2026-07-01T10:00"
        main.create_contact(contact_payload(owner_id="owner-a", name="Ana Silva", phone="11 90000-2222", next_follow_up_at=slot))
        created = main.create_contact(contact_payload(owner_id="owner-b", name="Bia Souza", phone="11 90000-3333", next_follow_up_at=slot))

        self.assertEqual(created["owner_id"], "owner-b")

    def test_contact_structured_tables_are_synced(self):
        created = main.create_contact(
            contact_payload(
                owner_id="owner-a",
                name="Contato Estruturado",
                phone="+55 11 98888-7777",
                email="contato@example.com",
                tags="limpeza, evento",
                custom_fields='[{"label":"Origem","value":"Evento ABC"}]',
            )
        )

        self.assertEqual(created["ddd"], "11")
        self.assertEqual([item["phone_digits"] for item in created["phones"]], ["5511988887777"])
        self.assertEqual(created["emails"][0]["normalized_email"], "contato@example.com")
        self.assertEqual(created["tag_items"], ["evento", "limpeza"])
        self.assertEqual(created["custom_field_values"][0]["value"], "Evento ABC")

        with database.get_connection() as connection:
            phone_rows = connection.execute("SELECT * FROM contact_phones WHERE contact_id = ?", (created["id"],)).fetchall()
            tag_rows = connection.execute("SELECT * FROM contact_tags WHERE contact_id = ?", (created["id"],)).fetchall()
            field_rows = connection.execute("SELECT * FROM custom_field_values WHERE contact_id = ?", (created["id"],)).fetchall()

        self.assertEqual(len(phone_rows), 1)
        self.assertEqual(len(tag_rows), 2)
        self.assertEqual(len(field_rows), 1)

    def test_chat_prepares_follow_up_for_selected_contact(self):
        contact = main.create_contact(contact_payload(owner_id="owner-a", name="Aline Prado", phone="11 90000-2222"))

        response = main.ai_chat(
            AiChatIn(
                user_id="owner-a",
                target_contact_id=contact["id"],
                message="agendar amanha 14h",
            )
        )

        self.assertEqual(response["provider"], "local")
        self.assertEqual(response["suggestions"][0]["action"], "set_crm")
        self.assertIn("T14:00", response["suggestions"][0]["next_follow_up_at"])

    def test_profile_save_requires_google_connection(self):
        payload = UserCreate(
            name="Nova Pessoa",
            email="nova@example.com",
            password="123456",
            phone="11 95555-1212",
        )

        with self.assertRaises(HTTPException) as raised:
            main.save_user(payload)

        self.assertEqual(raised.exception.status_code, 422)

    def test_public_profiles_load_with_boolean_filter(self):
        profiles = main.public_profiles(query="")

        self.assertGreaterEqual(len(profiles), 1)

    def test_google_login_works_on_sqlite_defaults(self):
        user = main.google_login(
            GoogleLoginIn(
                sub="google-user-1",
                email="google@example.com",
                name="Google User",
            )
        )

        self.assertTrue(user["google_connected"])

    def test_supabase_token_owner_overrides_client_owner_id(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            user = main.google_login(
                GoogleLoginIn(
                    sub="supabase-user-1",
                    email="supabase@example.com",
                    name="Supabase User",
                )
            )
            token = jwt.encode(
                {"sub": "supabase-user-1", "email": "supabase@example.com", "aud": "authenticated"},
                "test-secret",
                algorithm="HS256",
            )

            client = TestClient(main.app)
            response = client.post(
                "/api/contacts",
                headers={"Authorization": f"Bearer {token}"},
                json=contact_payload(owner_id="spoofed-owner", name="Contato Seguro", phone="11 97777-1010").model_dump(),
            )

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["owner_id"], str(user["id"]))
        finally:
            os.environ.pop("SUPABASE_JWT_SECRET", None)

    def test_supabase_token_creates_owner_before_contact_write(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            token = jwt.encode(
                {"sub": "supabase-user-2", "email": "new-supabase@example.com", "aud": "authenticated"},
                "test-secret",
                algorithm="HS256",
            )

            client = TestClient(main.app)
            response = client.post(
                "/api/contacts",
                headers={"Authorization": f"Bearer {token}"},
                json=contact_payload(owner_id="spoofed-owner", name="Contato Sincronizado", phone="11 97777-2020").model_dump(),
            )

            self.assertEqual(response.status_code, 201)
            self.assertNotEqual(response.json()["owner_id"], "spoofed-owner")
            with database.get_connection() as connection:
                user = database.find_user_by_email(connection, "new-supabase@example.com")
            self.assertEqual(response.json()["owner_id"], str(user["id"]))
        finally:
            os.environ.pop("SUPABASE_JWT_SECRET", None)

    def test_admin_can_create_group_and_share_contact(self):
        admin = main.save_user(
            UserCreate(
                name="Grupo Admin",
                email="grupo-admin@example.com",
                password="123456",
                phone="11 96666-1000",
                google_connected=True,
                role="admin",
            )
        )
        contact = main.create_contact(contact_payload(owner_id=str(admin["id"]), name="Contato de Grupo", phone="11 96666-2000"))

        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Hub de Teste",
                description="Grupo compartilhado para testes.",
            )
        )
        member = main.create_group_member(
            group["id"],
            GroupMemberCreate(
                requester_id=str(admin["id"]),
                email="membro@example.com",
                role="member",
            ),
        )
        shared_contact = main.create_group_contact(
            group["id"],
            GroupContactLinkIn(
                requester_id=str(admin["id"]),
                owner_id=str(admin["id"]),
                contact_id=contact["id"],
            ),
        )
        contacts = main.group_contacts(group["id"], user_id=str(admin["id"]))

        self.assertEqual(group["name"], "Hub de Teste")
        self.assertEqual(member["email"], "membro@example.com")
        self.assertEqual(shared_contact["id"], contact["id"])
        self.assertEqual([item["id"] for item in contacts], [contact["id"]])

    def test_standard_user_can_create_group(self):
        user = main.google_login(
            GoogleLoginIn(
                sub="standard-user-group",
                email="standard-group@example.com",
                name="Standard User",
            )
        )

        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(user["id"]),
                name="Grupo Aberto",
                description="Criado por usuário padrão.",
            )
        )

        self.assertEqual(group["name"], "Grupo Aberto")
        self.assertEqual(str(group["owner_id"]), str(user["id"]))
        self.assertEqual(group["member_count"], 1)
        self.assertEqual(group["members"][0]["role"], "owner")

    def test_group_owner_can_edit_group(self):
        user = main.google_login(
            GoogleLoginIn(
                sub="group-owner-edit",
                email="group-owner@example.com",
                name="Group Owner",
            )
        )
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(user["id"]),
                name="Grupo Inicial",
                description="Descricao inicial.",
            )
        )

        updated = main.edit_shared_group(
            group["id"],
            GroupCreate(
                owner_id=str(user["id"]),
                name="Grupo Atualizado",
                description="Descricao atualizada.",
            ),
        )

        self.assertEqual(updated["name"], "Grupo Atualizado")
        self.assertEqual(updated["description"], "Descricao atualizada.")

    def test_group_member_can_access_but_cannot_manage_contacts(self):
        admin = main.save_user(
            UserCreate(
                name="Admin de Grupo Restrito",
                email="admin-restrito@example.com",
                password="123456",
                phone="11 96666-3000",
                google_connected=True,
                role="admin",
            )
        )
        member = main.google_login(
            GoogleLoginIn(
                sub="member-group-readonly",
                email="membro-restrito@example.com",
                name="Membro Restrito",
            )
        )
        contact = main.create_contact(contact_payload(owner_id=str(member["id"]), name="Contato Privado", phone="11 96666-4000"))
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Grupo Somente Admin",
                description="Membros acessam, mas nao gerenciam contatos.",
            )
        )
        main.create_group_member(
            group["id"],
            GroupMemberCreate(
                requester_id=str(admin["id"]),
                email=member["email"],
                role="member",
            ),
        )

        contacts = main.group_contacts(group["id"], user_id=str(member["id"]))
        with self.assertRaises(HTTPException) as raised:
            main.create_group_contact(
                group["id"],
                GroupContactLinkIn(
                    requester_id=str(member["id"]),
                    owner_id=str(member["id"]),
                    contact_id=contact["id"],
                ),
            )

        self.assertEqual(contacts, [])
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
