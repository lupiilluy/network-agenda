import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import database, main
from app.schemas import AiChatIn, ChatMessageCreate, ChatThreadCreate, ContactCreate, CustomFieldDefinitionIn, GoogleLoginIn, GroupContactCustomFieldsIn, GroupContactLinkIn, GroupCreate, GroupMemberCreate, GroupMessageCreate, ImportJobCreate, PushDispatchIn, PushSubscriptionCreate, PushTestNotificationIn, UserCreate


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
        os.environ.pop("SUPABASE_JWT_SECRET", None)
        os.environ.pop("SUPABASE_URL", None)
        os.environ.pop("VITE_SUPABASE_URL", None)
        database.init_db()

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_health(self):
        self.assertEqual(main.health()["status"], "ok")

    def test_auth_status_reports_defaults(self):
        client = TestClient(main.app)
        response = client.get("/api/auth/status")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["supabase_auth_required"])
        self.assertFalse(payload["configured_supabase_url"])
        self.assertFalse(payload["configured_supabase_jwt_secret"])
        self.assertFalse(payload["configured_web_push_vapid"])
        self.assertTrue(payload["jwt_library_available"])
        self.assertFalse(payload["legacy_password_login_enabled"])
        self.assertEqual(payload["jwt_validation_mode"], "disabled")
        self.assertEqual(payload["database_dialect"], "sqlite")
        self.assertFalse(payload["rls_supported"])
        self.assertFalse(payload["rls_ready"])
        self.assertFalse(payload["production_auth_ready"])
        self.assertGreaterEqual(len(payload["warnings"]), 1)
        self.assertFalse(payload["authenticated"])

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
                phones=[
                    {"phone": "11 97777-6666", "label": "Comercial"},
                    {"phone": "11 96666-5555", "label": "Suporte"},
                ],
                emails=[
                    {"email": "financeiro@example.com", "label": "Financeiro"},
                ],
                tags="limpeza, evento",
                custom_fields='[{"label":"Origem","value":"Evento ABC"}]',
            )
        )

        self.assertEqual(created["ddd"], "11")
        self.assertEqual([item["phone_digits"] for item in created["phones"]], ["5511988887777", "11977776666", "11966665555"])
        self.assertEqual([item["normalized_email"] for item in created["emails"]], ["contato@example.com", "financeiro@example.com"])
        self.assertEqual(created["tag_items"], ["evento", "limpeza"])
        self.assertEqual(created["custom_field_values"][0]["value"], "Evento ABC")

        with database.get_connection() as connection:
            phone_rows = connection.execute("SELECT * FROM contact_phones WHERE contact_id = ?", (created["id"],)).fetchall()
            email_rows = connection.execute("SELECT * FROM contact_emails WHERE contact_id = ?", (created["id"],)).fetchall()
            tag_rows = connection.execute("SELECT * FROM contact_tags WHERE contact_id = ?", (created["id"],)).fetchall()
            field_rows = connection.execute("SELECT * FROM custom_field_values WHERE contact_id = ?", (created["id"],)).fetchall()

        self.assertEqual(len(phone_rows), 3)
        self.assertEqual(len(email_rows), 2)
        self.assertEqual(len(tag_rows), 2)
        self.assertEqual(len(field_rows), 1)

    def test_contact_demand_tags_are_persisted_and_searchable(self):
        created = main.create_contact(
            contact_payload(
                owner_id="owner-a",
                name="Clara Mendes",
                phone="11 97777-4444",
                service="consultoria operacional",
                demand="Precisa estruturar comercial e rotina financeira.",
                demand_tags="comercial, financeiro",
            )
        )

        self.assertEqual(created["demand_tags"], "comercial, financeiro")

        updated = main.edit_contact(
            created["id"],
            contact_payload(
                owner_id="owner-a",
                name="Clara Mendes",
                phone="11 97777-4444",
                service="consultoria operacional",
                demand="Agora busca apoio jurídico.",
                demand_tags="juridico, contrato",
            ),
        )

        self.assertEqual(updated["demand_tags"], "juridico, contrato")
        search_results = main.contacts(query="contrato", category="all", user_id="owner-a")
        self.assertEqual([contact["id"] for contact in search_results], [created["id"]])

    def test_contact_organization_is_persisted_and_searchable(self):
        created = main.create_contact(
            contact_payload(
                owner_id="owner-a",
                name="Beatriz Rocha",
                phone="11 97777-1111",
                service="consultora",
                organization="Nova Ponte Consultoria",
            )
        )

        self.assertEqual(created["organization"], "Nova Ponte Consultoria")

        updated = main.edit_contact(
            created["id"],
            contact_payload(
                owner_id="owner-a",
                name="Beatriz Rocha",
                phone="11 97777-1111",
                service="consultora",
                organization="Nova Ponte Ventures",
            ),
        )

        self.assertEqual(updated["organization"], "Nova Ponte Ventures")
        search_results = main.contacts(query="ventures", category="all", user_id="owner-a")
        self.assertEqual([contact["id"] for contact in search_results], [created["id"]])

    def test_contact_persists_link_to_existing_platform_user(self):
        owner = main.google_login(
            GoogleLoginIn(
                sub="owner-link-contact",
                email="owner-link@example.com",
                name="Owner Link",
            )
        )
        linked_user = main.save_user(
            UserCreate(
                name="Pessoa da Plataforma",
                email="plataforma@example.com",
                password="123456",
                phone="11 97777-3300",
                google_connected=True,
            )
        )

        created = main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Contato que vira usuario",
                phone=linked_user["phone"],
                email=linked_user["email"],
                service="consultoria",
            )
        )

        self.assertEqual(created["linked_user_id"], str(linked_user["id"]))
        self.assertEqual(created["linked_user_name"], linked_user["name"])
        self.assertEqual(created["linked_user_email"], linked_user["email"])

    def test_existing_contact_links_after_platform_user_registers(self):
        owner = main.google_login(
            GoogleLoginIn(
                sub="owner-link-later",
                email="owner-link-later@example.com",
                name="Owner Later",
            )
        )
        contact = main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Contato futuro usuario",
                phone="11 98888-7711",
                email="futuro.usuario@example.com",
                service="arquitetura",
            )
        )
        self.assertEqual(contact["linked_user_id"], "")

        linked_user = main.save_user(
            UserCreate(
                name="Futuro Usuario",
                email="futuro.usuario@example.com",
                password="123456",
                phone="11 98888-7711",
                google_connected=True,
            )
        )

        contacts = main.contacts(query="", category="all", user_id=str(owner["id"]))
        linked_contact = next(item for item in contacts if item["id"] == contact["id"])

        self.assertEqual(linked_contact["linked_user_id"], str(linked_user["id"]))
        self.assertEqual(linked_contact["linked_user_name"], linked_user["name"])

    def test_contact_exposes_public_profile_match_and_potential_matches(self):
        owner = main.save_user(
            UserCreate(
                name="Dona da Agenda",
                email="owner-meta@example.com",
                password="123456",
                phone="11 97777-8800",
                google_connected=True,
            )
        )
        public_user = main.save_user(
            UserCreate(
                name="Bianca Limpeza",
                email="bianca.limpeza@example.com",
                password="123456",
                phone="11 97777-8801",
                google_connected=True,
                public_visible=True,
                public_description="Profissional aberta para networking.",
                public_solves="Limpeza residencial e pós-obra.",
                public_tags="limpeza, faxina, pós-obra",
            )
        )
        main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Resolve limpeza",
                phone="11 97777-8802",
                service="limpeza residencial",
                tags="limpeza, faxina",
                solves="Limpeza de casa e pós-obra.",
            )
        )

        created = main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Bianca da rede",
                phone=public_user["phone"],
                email=public_user["email"],
                service="contato para revisar",
                demand="Precisa de ajuda com limpeza de apartamento.",
                demand_tags="limpeza, apartamento",
            )
        )

        self.assertEqual(created["platform_match"]["user_id"], str(public_user["id"]))
        self.assertEqual(created["public_profile_match"]["source_user_id"], public_user["id"])
        self.assertGreaterEqual(len(created["potential_matches"]), 1)
        self.assertEqual(created["potential_matches"][0]["name"], "Resolve limpeza")

    def test_contact_does_not_link_to_owner_itself(self):
        owner = main.save_user(
            UserCreate(
                name="Dono da Agenda",
                email="self-link@example.com",
                password="123456",
                phone="11 97777-8899",
                google_connected=True,
            )
        )

        created = main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Meu proprio contato",
                phone=owner["phone"],
                email=owner["email"],
                service="perfil pessoal",
            )
        )

        self.assertEqual(created["linked_user_id"], "")
        self.assertEqual(created["linked_user_name"], "")

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

    def test_group_ai_chat_uses_shared_group_contacts_scope(self):
        admin = main.save_user(
            UserCreate(
                name="Admin Copiloto Grupo",
                email="admin-copiloto-grupo@example.com",
                password="123456",
                phone="11 97777-1000",
                google_connected=True,
                role="admin",
            )
        )
        main.create_contact(contact_payload(owner_id=str(admin["id"]), name="Contato Privado", phone="11 97777-1001", service="advogado"))
        shared_contact = main.create_contact(
            contact_payload(
                owner_id=str(admin["id"]),
                name="Bianca Limpeza",
                phone="11 97777-1002",
                service="limpeza residencial",
                tags="limpeza, faxina",
            )
        )
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Grupo de Limpeza",
                area="Limpeza",
                people_goal=3,
                description="Grupo para testar busca do copiloto.",
            )
        )
        main.create_group_contact(
            group["id"],
            GroupContactLinkIn(
                requester_id=str(admin["id"]),
                owner_id=str(admin["id"]),
                contact_id=shared_contact["id"],
            ),
        )

        response = main.ai_chat(
            AiChatIn(
                user_id=str(admin["id"]),
                group_id=group["id"],
                message="quem pode ajudar com limpeza?",
            )
        )

        self.assertEqual(response["provider"], "local")
        self.assertIn("Bianca Limpeza", response["answer"])
        self.assertNotIn("Contato Privado", response["answer"])

    def test_group_ai_chat_requires_group_access(self):
        admin = main.save_user(
            UserCreate(
                name="Admin Copiloto Privado",
                email="admin-copiloto-privado@example.com",
                password="123456",
                phone="11 97777-2000",
                google_connected=True,
                role="admin",
            )
        )
        outsider = main.google_login(
            GoogleLoginIn(
                sub="outsider-group-ai",
                email="outsider-group-ai@example.com",
                name="Outsider",
            )
        )
        shared_contact = main.create_contact(
            contact_payload(
                owner_id=str(admin["id"]),
                name="Contato Restrito",
                phone="11 97777-2001",
                service="limpeza comercial",
                tags="limpeza",
            )
        )
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Grupo Restrito",
                area="Limpeza",
                people_goal=3,
                description="Grupo fechado.",
            )
        )
        main.create_group_contact(
            group["id"],
            GroupContactLinkIn(
                requester_id=str(admin["id"]),
                owner_id=str(admin["id"]),
                contact_id=shared_contact["id"],
            ),
        )

        with self.assertRaises(HTTPException) as raised:
            main.ai_chat(
                AiChatIn(
                    user_id=str(outsider["id"]),
                    group_id=group["id"],
                    message="quem resolve limpeza?",
                )
            )

        self.assertEqual(raised.exception.status_code, 403)

    def test_private_ai_chat_creates_thread_and_persists_messages(self):
        contact = main.create_contact(
            contact_payload(
                owner_id="owner-chat",
                name="Paulo Financeiro",
                phone="11 97777-3100",
                service="consultoria financeira",
                tags="financeiro, planejamento",
            )
        )

        response = main.ai_chat(
            AiChatIn(
                user_id="owner-chat",
                message="quem pode ajudar com financeiro?",
                target_contact_id=contact["id"],
            )
        )

        self.assertIsInstance(response["thread_id"], int)

        threads = main.chat_threads(user_id="owner-chat")
        self.assertEqual(len(threads), 1)
        self.assertEqual(threads[0]["id"], response["thread_id"])
        self.assertGreaterEqual(threads[0]["message_count"], 2)

        messages = main.chat_thread_messages(response["thread_id"], user_id="owner-chat")
        self.assertEqual([message["role"] for message in messages], ["user", "assistant"])
        self.assertEqual(messages[0]["text"], "quem pode ajudar com financeiro?")
        self.assertEqual(messages[1]["provider"], response["provider"])

    def test_chat_message_endpoint_appends_to_existing_thread(self):
        thread = main.create_private_chat_thread(ChatThreadCreate(user_id="owner-thread", title="Follow-up"))

        saved = main.create_private_chat_message(
            thread["id"],
            ChatMessageCreate(
                user_id="owner-thread",
                role="assistant",
                text="Abra o CRM para revisar os próximos follow-ups.",
                provider="local",
                suggestions=[],
                cta_label="Ver no CRM",
                cta_route="/crm",
            ),
        )

        messages = main.chat_thread_messages(thread["id"], user_id="owner-thread")

        self.assertEqual(saved["cta"]["route"], "/crm")
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["text"], "Abra o CRM para revisar os próximos follow-ups.")

    def test_import_jobs_are_logged_by_owner(self):
        created = main.create_contact_import_job(
            ImportJobCreate(
                user_id="owner-import",
                source="CSV",
                filename="contatos.csv",
                status="completed",
                total_count=12,
                imported_count=10,
                skipped_count=1,
                failed_count=1,
                details="Arquivo com cabeçalho padrão.",
            )
        )
        main.create_contact_import_job(
            ImportJobCreate(
                user_id="other-import",
                source="Google Contacts",
                filename="",
                status="completed",
                total_count=3,
                imported_count=3,
            )
        )

        jobs = main.import_jobs(user_id="owner-import")

        self.assertEqual([job["id"] for job in jobs], [created["id"]])
        self.assertEqual(jobs[0]["filename"], "contatos.csv")
        self.assertEqual(jobs[0]["imported_count"], 10)

    def test_push_subscriptions_are_upserted_and_scoped_by_owner(self):
        created = main.create_push_subscription(
            PushSubscriptionCreate(
                user_id="owner-push",
                endpoint="https://push.example.com/subscriptions/abc",
                p256dh_key="p256dh-key",
                auth_key="auth-key",
                device_label="Chrome desktop",
            )
        )
        updated = main.create_push_subscription(
            PushSubscriptionCreate(
                user_id="owner-push",
                endpoint="https://push.example.com/subscriptions/abc",
                p256dh_key="p256dh-key-2",
                auth_key="auth-key-2",
                device_label="Android PWA",
            )
        )

        owner_subscriptions = main.push_subscriptions(user_id="owner-push")
        other_subscriptions = main.push_subscriptions(user_id="owner-other")

        self.assertEqual(created["id"], updated["id"])
        self.assertEqual(owner_subscriptions[0]["device_label"], "Android PWA")
        self.assertEqual(owner_subscriptions[0]["p256dh_key"], "p256dh-key-2")
        self.assertEqual(other_subscriptions, [])

    def test_contacts_search_matches_custom_field_values(self):
        main.create_contact(
            contact_payload(
                owner_id="owner-search",
                name="Bruna Eventos",
                phone="11 97777-4433",
                service="cerimonialista",
                custom_field_values=[
                    {
                        "name": "Especialidade",
                        "key": "especialidade",
                        "field_type": "text_short",
                        "scope_type": "user",
                        "scope_id": "",
                        "value": "casamentos de luxo",
                    }
                ],
            )
        )

        results = main.contacts(query="casamentos luxo", category="all", user_id="owner-search")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Bruna Eventos")

    def test_search_returns_insights_for_matches(self):
        owner = main.save_user(
            UserCreate(
                name="Owner Search",
                email="owner-search-insights@example.com",
                password="123456",
                phone="11 97777-4430",
                google_connected=True,
            )
        )
        main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Carlos Resolve",
                phone="11 97777-4431",
                service="consultoria financeira",
                solves="Resolve financeiro, fluxo de caixa e precificação.",
                tags="financeiro, precificação",
            )
        )
        main.create_contact(
            contact_payload(
                owner_id=str(owner["id"]),
                name="Ana Busca",
                phone="11 97777-4432",
                service="loja",
                demand="Busca ajuda com financeiro e precificação.",
                demand_tags="financeiro, precificação",
            )
        )

        result = main.search(query="quem pode ajudar com financeiro?", user_id=str(owner["id"]))

        self.assertTrue(result["has_private_results"])
        self.assertGreaterEqual(len(result["insights"]), 1)

    def test_import_integrations_endpoint_exposes_native_and_file_modes(self):
        integrations = main.import_integrations()

        providers = {item["provider"]: item for item in integrations}
        self.assertEqual(providers["google_contacts"]["status"], "implemented")
        self.assertEqual(providers["apple_contacts_native"]["status"], "coming_soon")
        self.assertIn("vcf", providers["apple_contacts_native"]["supported_formats"])

    def test_dispatch_push_notifications_sends_due_follow_up(self):
        main.create_push_subscription(
            PushSubscriptionCreate(
                user_id="owner-push-auto",
                endpoint="https://push.example.com/subscriptions/auto-1",
                p256dh_key="p256dh-key",
                auth_key="auth-key",
                device_label="Android PWA",
            )
        )
        main.create_contact(
            contact_payload(
                owner_id="owner-push-auto",
                name="Contato urgente",
                phone="11 97777-4440",
                next_follow_up_at=(main.datetime.now() + main.timedelta(hours=3)).isoformat(timespec="minutes"),
            )
        )
        os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"] = "test-private-key"
        os.environ["WEB_PUSH_VAPID_SUBJECT"] = "mailto:test@example.com"
        try:
            with patch.object(main, "resolve_vapid_private_key", return_value="pem-private-key"), patch.object(main, "webpush", return_value=None):
                result = main.dispatch_push_notifications(PushDispatchIn(user_id="owner-push-auto", kinds=["follow_up"]))
        finally:
            os.environ.pop("WEB_PUSH_VAPID_PRIVATE_KEY", None)
            os.environ.pop("WEB_PUSH_VAPID_SUBJECT", None)

        self.assertGreaterEqual(result["sent"], 1)
        self.assertIn("follow_up", result["events"])

    def test_dispatch_push_notifications_deduplicates_recent_follow_up_event(self):
        main.create_push_subscription(
            PushSubscriptionCreate(
                user_id="owner-push-repeat",
                endpoint="https://push.example.com/subscriptions/repeat-1",
                p256dh_key="p256dh-key",
                auth_key="auth-key",
                device_label="Android PWA",
            )
        )
        main.create_contact(
            contact_payload(
                owner_id="owner-push-repeat",
                name="Contato repetido",
                phone="11 97777-4449",
                next_follow_up_at=(main.datetime.now() + main.timedelta(hours=2)).isoformat(timespec="minutes"),
            )
        )
        os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"] = "test-private-key"
        os.environ["WEB_PUSH_VAPID_SUBJECT"] = "mailto:test@example.com"
        try:
            with patch.object(main, "resolve_vapid_private_key", return_value="pem-private-key"), patch.object(main, "webpush", return_value=None):
                first = main.dispatch_push_notifications(PushDispatchIn(user_id="owner-push-repeat", kinds=["follow_up"]))
                second = main.dispatch_push_notifications(PushDispatchIn(user_id="owner-push-repeat", kinds=["follow_up"]))
        finally:
            os.environ.pop("WEB_PUSH_VAPID_PRIVATE_KEY", None)
            os.environ.pop("WEB_PUSH_VAPID_SUBJECT", None)

        self.assertGreaterEqual(first["sent"], 1)
        self.assertIn("follow_up", first["events"])
        self.assertEqual(second["sent"], 0)
        self.assertEqual(second["events"], [])

    def test_push_test_notification_uses_registered_subscriptions(self):
        main.create_push_subscription(
            PushSubscriptionCreate(
                user_id="owner-push-test",
                endpoint="https://push.example.com/subscriptions/test-1",
                p256dh_key="p256dh-key",
                auth_key="auth-key",
                device_label="Chrome desktop",
            )
        )
        os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"] = "test-private-key"
        os.environ["WEB_PUSH_VAPID_SUBJECT"] = "mailto:test@example.com"
        try:
            with patch.object(main, "resolve_vapid_private_key", return_value="pem-private-key"), patch.object(main, "webpush", return_value=None):
                result = main.send_test_push_notification(
                    PushTestNotificationIn(
                        user_id="owner-push-test",
                        title="Teste",
                        body="Funcionou",
                        route="/configuracoes",
                    )
                )
        finally:
            os.environ.pop("WEB_PUSH_VAPID_PRIVATE_KEY", None)
            os.environ.pop("WEB_PUSH_VAPID_SUBJECT", None)

        self.assertEqual(result["sent"], 1)
        self.assertEqual(result["failed"], 0)

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

    def test_public_profile_whatsapp_requires_explicit_public_value(self):
        user = main.save_user(
            UserCreate(
                name="Perfil Sem WhatsApp",
                email="perfil-sem-whatsapp@example.com",
                password="123456",
                phone="11 95555-7777",
                google_connected=True,
                public_visible=True,
                public_description="Perfil publico de teste.",
                public_solves="Resolve problemas de networking.",
            )
        )

        profile = next(item for item in main.public_profiles(query="Perfil Sem WhatsApp") if item["source_user_id"] == user["id"])

        self.assertEqual(profile["whatsapp"], "")

    def test_google_login_works_on_sqlite_defaults(self):
        user = main.google_login(
            GoogleLoginIn(
                sub="google-user-1",
                email="google@example.com",
                name="Google User",
            )
        )

        self.assertTrue(user["google_connected"])

    def test_local_login_is_disabled_by_default(self):
        client = TestClient(main.app)
        response = client.post(
            "/api/login",
            json={"email": "demo@network.local", "password": "123456"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("legado desabilitado", response.json()["detail"])

    def test_supabase_auth_session_sync_keeps_email_provider_without_google_flag(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            token = jwt.encode(
                {
                    "sub": "supabase-email-user",
                    "email": "email-provider@example.com",
                    "aud": "authenticated",
                    "app_metadata": {"provider": "email"},
                },
                "test-secret",
                algorithm="HS256",
            )
            client = TestClient(main.app)
            response = client.post(
                "/api/auth/session",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "sub": "spoofed-sub",
                    "email": "email-provider@example.com",
                    "name": "Email Provider",
                    "auth_provider": "email",
                },
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["email"], "email-provider@example.com")
            self.assertFalse(response.json()["google_connected"])
        finally:
            os.environ.pop("SUPABASE_JWT_SECRET", None)

    def test_supabase_auth_session_sync_marks_google_provider_as_connected(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            token = jwt.encode(
                {
                    "sub": "supabase-google-user",
                    "email": "google-provider@example.com",
                    "aud": "authenticated",
                    "app_metadata": {"provider": "google"},
                },
                "test-secret",
                algorithm="HS256",
            )
            client = TestClient(main.app)
            response = client.post(
                "/api/auth/session",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "sub": "spoofed-sub",
                    "email": "google-provider@example.com",
                    "name": "Google Provider",
                    "auth_provider": "email",
                },
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["email"], "google-provider@example.com")
            self.assertTrue(response.json()["google_connected"])
        finally:
            os.environ.pop("SUPABASE_JWT_SECRET", None)

    def test_supabase_token_owner_overrides_client_owner_id(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            token = jwt.encode(
                {"sub": "supabase-user-1", "email": "supabase@example.com", "aud": "authenticated"},
                "test-secret",
                algorithm="HS256",
            )

            client = TestClient(main.app)
            login_response = client.post(
                "/api/google-login",
                headers={"Authorization": f"Bearer {token}"},
                json=GoogleLoginIn(
                    sub="spoofed-sub",
                    email="supabase@example.com",
                    name="Supabase User",
                ).model_dump(),
            )
            response = client.post(
                "/api/contacts",
                headers={"Authorization": f"Bearer {token}"},
                json=contact_payload(owner_id="spoofed-owner", name="Contato Seguro", phone="11 97777-1010").model_dump(),
            )

            self.assertEqual(login_response.status_code, 200)
            self.assertEqual(login_response.json()["email"], "supabase@example.com")
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["owner_id"], str(login_response.json()["id"]))
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

    def test_supabase_auth_required_blocks_local_login_and_private_routes(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            client = TestClient(main.app)
            contacts_response = client.get("/api/contacts?user_id=test-user")
            login_response = client.post(
                "/api/login",
                json={"email": "demo@network.local", "password": "123456"},
            )

            self.assertEqual(contacts_response.status_code, 401)
            self.assertEqual(login_response.status_code, 403)
        finally:
            os.environ.pop("SUPABASE_JWT_SECRET", None)

    def test_supabase_google_login_route_uses_bearer_identity(self):
        os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
        try:
            token = jwt.encode(
                {"sub": "supabase-route-user", "email": "route@example.com", "aud": "authenticated"},
                "test-secret",
                algorithm="HS256",
            )
            client = TestClient(main.app)
            response = client.post(
                "/api/google-login",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "sub": "spoofed-sub",
                    "email": "route@example.com",
                    "name": "Spoofed Name",
                },
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["email"], "route@example.com")
        finally:
            os.environ.pop("SUPABASE_JWT_SECRET", None)

    def test_supabase_auth_required_with_url_only_blocks_local_login(self):
        os.environ["SUPABASE_URL"] = "https://qbqqfkvvbvsdpwsajkha.supabase.co"
        try:
            client = TestClient(main.app)
            contacts_response = client.get("/api/contacts?user_id=test-user")
            login_response = client.post(
                "/api/login",
                json={"email": "demo@network.local", "password": "123456"},
            )

            self.assertEqual(contacts_response.status_code, 401)
            self.assertEqual(login_response.status_code, 403)
        finally:
            os.environ.pop("SUPABASE_URL", None)

    def test_production_env_blocks_demo_fallback_without_supabase(self):
        os.environ["APP_ENV"] = "production"
        try:
            client = TestClient(main.app)
            status_response = client.get("/api/auth/status")
            contacts_response = client.get("/api/contacts?user_id=test-user")

            self.assertEqual(status_response.status_code, 200)
            self.assertTrue(status_response.json()["production_auth_enforced"])
            self.assertFalse(status_response.json()["demo_fallback_enabled"])
            self.assertEqual(contacts_response.status_code, 503)
        finally:
            os.environ.pop("APP_ENV", None)

    def test_auth_status_reports_production_not_ready_on_sqlite_even_with_supabase_url(self):
        os.environ["SUPABASE_URL"] = "https://qbqqfkvvbvsdpwsajkha.supabase.co"
        try:
            client = TestClient(main.app)
            response = client.get("/api/auth/status")

            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertTrue(payload["supabase_auth_required"])
            self.assertEqual(payload["database_dialect"], "sqlite")
            self.assertFalse(payload["production_auth_ready"])
            self.assertFalse(payload["rls_ready"])
            self.assertIn("SQLite", " ".join(payload["warnings"]))
        finally:
            os.environ.pop("SUPABASE_URL", None)

    def test_supabase_jwks_claims_are_used_when_secret_is_missing(self):
        os.environ["SUPABASE_URL"] = "https://qbqqfkvvbvsdpwsajkha.supabase.co"
        try:
            with patch.object(main, "decode_supabase_hs256_claims", return_value=None), patch.object(
                main,
                "supabase_unverified_claims",
                return_value={"iss": "https://qbqqfkvvbvsdpwsajkha.supabase.co/auth/v1"},
            ), patch.object(
                main,
                "decode_supabase_jwks_claims",
                return_value={"sub": "jwks-user", "email": "jwks@example.com", "aud": "authenticated"},
            ) as decode_jwks:
                claims = main.decode_supabase_token("fake-token")

            self.assertEqual(claims, {"sub": "jwks-user", "email": "jwks@example.com"})
            decode_jwks.assert_called_once_with("fake-token", "https://qbqqfkvvbvsdpwsajkha.supabase.co/auth/v1")
        finally:
            os.environ.pop("SUPABASE_URL", None)

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
        contact = main.create_contact(contact_payload(owner_id=str(admin["id"]), name="Contato de Grupo", phone="11 96666-2000", tags="Comunidade empresarial"))

        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Hub de Teste",
                area="Comunidade empresarial",
                people_goal=3,
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
        message = main.create_shared_group_message(
            group["id"],
            GroupMessageCreate(requester_id=str(admin["id"]), message="Bem-vindos ao grupo."),
        )
        messages = main.group_messages(group["id"], user_id=str(admin["id"]))
        client = TestClient(main.app)
        cleared = client.delete(f"/api/groups/{group['id']}/messages?requester_id={admin['id']}")
        messages_after_clear = main.group_messages(group["id"], user_id=str(admin["id"]))

        self.assertEqual(group["name"], "Hub de Teste")
        self.assertEqual(group["area"], "Comunidade empresarial")
        self.assertEqual(group["people_goal"], 3)
        self.assertEqual(member["email"], "membro@example.com")
        self.assertEqual(shared_contact["id"], contact["id"])
        self.assertEqual([item["id"] for item in contacts], [contact["id"]])
        self.assertEqual(message["message"], "Bem-vindos ao grupo.")
        self.assertEqual([item["message"] for item in messages], ["Bem-vindos ao grupo."])
        self.assertEqual(cleared.status_code, 204)
        self.assertEqual(messages_after_clear, [])

    def test_graph_endpoint_exposes_semantic_nodes_and_edges(self):
        main.create_contact(
            contact_payload(
                owner_id="owner-graph",
                name="Contato Grafo",
                phone="11 96666-7777",
                service="limpeza residencial",
                tags="limpeza, condomínio",
                demand="Busca parceria com síndicos.",
                demand_tags="condomínio",
                solves="Limpeza pós-obra.",
                organization="Rede Alfa",
            )
        )

        graph = main.graph(scope="private", user_id="owner-graph")
        node_types = {node["type"] for node in graph["nodes"]}
        edge_types = {edge["type"] for edge in graph["edges"]}

        self.assertIn("contact", node_types)
        self.assertIn("tag", node_types)
        self.assertIn("ddd", node_types)
        self.assertIn("demand", node_types)
        self.assertIn("solution", node_types)
        self.assertIn("organization", node_types)
        self.assertIn("has_tag", edge_types)
        self.assertIn("demands", edge_types)
        self.assertIn("solves", edge_types)

    def test_standard_user_cannot_create_group(self):
        user = main.google_login(
            GoogleLoginIn(
                sub="standard-user-group",
                email="standard-group@example.com",
                name="Standard User",
            )
        )

        with self.assertRaises(HTTPException) as raised:
            main.create_shared_group(
                GroupCreate(
                    owner_id=str(user["id"]),
                    name="Grupo Aberto",
                    area="Eventos",
                    people_goal=3,
                    description="Criado por usuario padrao.",
                )
            )

        self.assertEqual(raised.exception.status_code, 403)

    def test_group_creation_requires_at_least_three_people(self):
        admin = main.save_user(
            UserCreate(
                name="Admin Grupo Pequeno",
                email="admin-grupo-pequeno@example.com",
                password="123456",
                phone="11 96666-2400",
                google_connected=True,
                role="admin",
            )
        )

        client = TestClient(main.app)
        response = client.post(
            "/api/groups",
            json={
                "owner_id": str(admin["id"]),
                "name": "Grupo Pequeno",
                "area": "Eventos",
                "people_goal": 2,
                "description": "Grupo abaixo do mínimo.",
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_admin_group_owner_can_edit_group(self):
        user = main.save_user(
            UserCreate(
                name="Group Owner",
                email="group-owner@example.com",
                password="123456",
                phone="11 96666-2500",
                google_connected=True,
                role="admin",
            )
        )
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(user["id"]),
                name="Grupo Inicial",
                area="Networking B2B",
                people_goal=3,
                description="Descricao inicial.",
            )
        )

        updated = main.edit_shared_group(
            group["id"],
            GroupCreate(
                owner_id=str(user["id"]),
                name="Grupo Atualizado",
                area="Networking atualizado",
                people_goal=5,
                description="Descricao atualizada.",
            ),
        )

        self.assertEqual(updated["name"], "Grupo Atualizado")
        self.assertEqual(updated["area"], "Networking atualizado")
        self.assertEqual(updated["people_goal"], 5)
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
                area="Comunidade fechada",
                people_goal=3,
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

    def test_group_contact_must_match_group_area(self):
        admin = main.save_user(
            UserCreate(
                name="Admin Area Grupo",
                email="admin-area-grupo@example.com",
                password="123456",
                phone="11 96666-5100",
                google_connected=True,
                role="admin",
            )
        )
        contact = main.create_contact(contact_payload(owner_id=str(admin["id"]), name="Contato Fora da Area", phone="11 96666-5200", tags="Tecnologia"))
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Grupo Limpeza",
                area="Limpeza",
                people_goal=3,
                description="Apenas contatos da area de limpeza.",
            )
        )

        with self.assertRaises(HTTPException) as raised:
            main.create_group_contact(
                group["id"],
                GroupContactLinkIn(
                    requester_id=str(admin["id"]),
                    owner_id=str(admin["id"]),
                    contact_id=contact["id"],
                ),
            )

        self.assertEqual(raised.exception.status_code, 422)

    def test_user_custom_field_definition_crud(self):
        user = main.google_login(
            GoogleLoginIn(
                sub="custom-field-user",
                email="custom-field-user@example.com",
                name="Campo User",
            )
        )

        created = main.create_custom_field(
            CustomFieldDefinitionIn(
                owner_id=str(user["id"]),
                scope_type="user",
                scope_id="",
                name="Empresa",
                field_type="text_short",
                options=[],
            )
        )
        listed = main.custom_fields(user_id=str(user["id"]), scope_type="user", scope_id="")
        updated = main.edit_custom_field(
            created["id"],
            CustomFieldDefinitionIn(
                owner_id=str(user["id"]),
                scope_type="user",
                scope_id="",
                name="Empresa atual",
                field_type="text_long",
                options=[],
            ),
        )
        main.remove_custom_field(created["id"], requester_id=str(user["id"]))
        listed_after_delete = main.custom_fields(user_id=str(user["id"]), scope_type="user", scope_id="")

        self.assertEqual(created["name"], "Empresa")
        self.assertEqual(len(listed), 1)
        self.assertEqual(updated["name"], "Empresa atual")
        self.assertEqual(updated["field_type"], "text_long")
        self.assertEqual(listed_after_delete, [])

    def test_group_custom_fields_can_be_saved_for_shared_contact(self):
        admin = main.save_user(
            UserCreate(
                name="Admin Campo Grupo",
                email="admin-campo-grupo@example.com",
                password="123456",
                phone="11 98888-1000",
                google_connected=True,
                role="admin",
            )
        )
        contact = main.create_contact(contact_payload(owner_id=str(admin["id"]), name="Contato Campo Grupo", phone="11 98888-2000", tags="Eventos e stands"))
        group = main.create_shared_group(
            GroupCreate(
                owner_id=str(admin["id"]),
                name="Grupo Campos",
                area="Eventos e stands",
                people_goal=3,
                description="Grupo para validar campos customizados.",
            )
        )
        main.create_group_contact(
            group["id"],
            GroupContactLinkIn(
                requester_id=str(admin["id"]),
                owner_id=str(admin["id"]),
                contact_id=contact["id"],
            ),
        )
        field = main.create_custom_field(
            CustomFieldDefinitionIn(
                owner_id=str(admin["id"]),
                scope_type="group",
                scope_id=str(group["id"]),
                name="Stand",
                field_type="dropdown",
                options=["A1", "B2"],
            )
        )

        updated_contact = main.edit_group_contact_custom_fields(
            group["id"],
            contact["id"],
            GroupContactCustomFieldsIn(
                requester_id=str(admin["id"]),
                owner_id=str(admin["id"]),
                custom_field_values=[
                    {
                        "name": "Stand",
                        "key": field["field_key"],
                        "field_type": "dropdown",
                        "scope_type": "group",
                        "scope_id": str(group["id"]),
                        "options": ["A1", "B2"],
                        "value": "A1",
                    }
                ],
            ),
        )

        group_fields = main.custom_fields(user_id=str(admin["id"]), scope_type="group", scope_id=str(group["id"]))

        self.assertEqual(group_fields[0]["name"], "Stand")
        self.assertTrue(
            any(
                item["scope_type"] == "group"
                and item["scope_id"] == str(group["id"])
                and item["value"] == "A1"
                for item in updated_contact["custom_field_values"]
            )
        )


if __name__ == "__main__":
    unittest.main()
