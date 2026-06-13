import os
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from app import database, main
from app.schemas import AiChatIn, ContactCreate, GoogleLoginIn, UserCreate


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


if __name__ == "__main__":
    unittest.main()
