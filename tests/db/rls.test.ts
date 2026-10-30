import { afterAll, describe, expect, it } from "vitest";
import { actAs, as, asOwner, closePool, ids, inTx } from "./db";
import { AUTH, DOCUMENT, EVIDENCE, FINDING, MATTER, ORG, PROPERTY, USER } from "./fixtures";

afterAll(closePool);

const RLS_VIOLATION = /row-level security|permission denied/;

describe("anonymous access", () => {
  it.each(["properties", "organisations", "documents", "findings", "matters", "audit_events", "users"])(
    "cannot read %s",
    async (table) => {
      await expect(as(null, (c) => c.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    },
  );

  it("cannot call create_organisation", async () => {
    await expect(
      as(null, (c) => c.query("select public.create_organisation('x', 'investor')")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("organisation isolation", () => {
  it("investor sees only their organisation's properties", async () => {
    const ivy = await as(AUTH.ivy, (c) => ids(c, "select id from public.properties"));
    expect(ivy).toEqual([PROPERTY.invitedOnly, PROPERTY.sharedActive].sort());

    const oscar = await as(AUTH.oscar, (c) => ids(c, "select id from public.properties"));
    expect(oscar).toEqual([PROPERTY.westside]);
  });

  it("another tenant cannot read evidence, documents or findings", async () => {
    await as(AUTH.oscar, async (c) => {
      const evidence = await c.query("select 1 from public.evidence where property_id = $1", [PROPERTY.invitedOnly]);
      const docs = await c.query("select 1 from public.documents where owner_org_id = $1", [ORG.harbourview]);
      const findings = await c.query("select 1 from public.findings where document_id = $1", [DOCUMENT.matterContract]);
      expect(evidence.rowCount).toBe(0);
      expect(docs.rowCount).toBe(0);
      expect(findings.rowCount).toBe(0);
    });
  });

  it("another tenant cannot create a property in someone else's organisation", async () => {
    await expect(
      as(AUTH.oscar, (c) =>
        c.query("insert into public.properties (owner_org_id, address) values ($1, '1 Intruder St')", [ORG.harbourview]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it("another tenant cannot update or delete someone else's property", async () => {
    await as(AUTH.oscar, async (c) => {
      const upd = await c.query("update public.properties set address = 'hijacked' where id = $1", [PROPERTY.invitedOnly]);
      const del = await c.query("delete from public.properties where id = $1", [PROPERTY.invitedOnly]);
      expect(upd.rowCount).toBe(0);
      expect(del.rowCount).toBe(0);
    });
  });

  it("cannot move a property into another organisation", async () => {
    await expect(
      as(AUTH.ivy, (c) =>
        c.query("update public.properties set owner_org_id = $1 where id = $2", [ORG.westside, PROPERTY.invitedOnly]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it("professional organisations cannot own property workspaces", async () => {
    await expect(
      as(AUTH.connie, (c) =>
        c.query("insert into public.properties (owner_org_id, address) values ($1, '9 Firm St')", [ORG.firm]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it("users only see profiles they share an organisation with", async () => {
    const oscarSees = await as(AUTH.oscar, (c) => ids(c, "select id from public.users"));
    expect(oscarSees).toEqual([USER.oscar]);

    const connieSees = await as(AUTH.connie, (c) => ids(c, "select id from public.users"));
    expect(connieSees).toEqual([USER.connie, USER.sam].sort());
  });
});

describe("investor workspace permissions", () => {
  it("investor can create a property and attach evidence", async () => {
    await as(AUTH.ivy, async (c) => {
      const { rows } = await c.query(
        "insert into public.properties (owner_org_id, address, suburb, postcode) values ($1, '1 New St', 'Ryde', '2112') returning id, created_by",
        [ORG.harbourview],
      );
      expect(rows[0].created_by).toBe(USER.ivy);
      const ev = await c.query(
        "insert into public.evidence (property_id, title, source_type, source_url, fetched_at) values ($1, 'Cert', 'planning_certificate', 'https://example.com/c.pdf', current_date) returning verification_status",
        [rows[0].id],
      );
      expect(ev.rows[0].verification_status).toBe("unverified");
    });
  });

  it("verification is stamped by the server, not the client", async () => {
    await as(AUTH.ivy, async (c) => {
      const prop = await c.query(
        "insert into public.properties (owner_org_id, address) values ($1, '5 Real Data St') returning id",
        [ORG.harbourview],
      );
      const ev = await c.query(
        "insert into public.evidence (property_id, title, source_type, source_url, fetched_at) values ($1, 'Cert', 'planning_certificate', 'https://example.com/c.pdf', current_date) returning id",
        [prop.rows[0].id],
      );
      const { rows } = await c.query(
        "update public.evidence set verification_status = 'verified', verified_by = $1 where id = $2 returning verified_by, verified_at",
        [USER.oscar, ev.rows[0].id],
      );
      expect(rows[0].verified_by).toBe(USER.ivy);
      expect(rows[0].verified_at).not.toBeNull();
    });
  });

  it("rejects non-https evidence URLs and unknown jurisdictions", async () => {
    await expect(
      as(AUTH.ivy, (c) =>
        c.query(
          "insert into public.evidence (property_id, title, source_type, source_url, fetched_at) values ($1, 'x', 'other', 'http://insecure.example', current_date)",
          [PROPERTY.invitedOnly],
        ),
      ),
    ).rejects.toThrow(/evidence_source_url_check/);
    await expect(
      as(AUTH.ivy, (c) =>
        c.query("insert into public.properties (owner_org_id, address, jurisdiction) values ($1, '1 Nowhere St', 'XX')", [
          ORG.harbourview,
        ]),
      ),
    ).rejects.toThrow(/properties_jurisdiction_check/);
  });

  it("scenarios are private to the investor organisation, even on shared matters", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      await c.query(
        "insert into public.scenarios (property_id, name, formula_version) values ($1, 'Duplex', 'fixture-0')",
        [PROPERTY.sharedActive],
      );
      await actAs(c, AUTH.connie);
      const seen = await c.query("select 1 from public.scenarios");
      expect(seen.rowCount).toBe(0);
    });
  });
});

describe("session revocation", () => {
  it("a signed-out session loses all access, even with a still-valid token", async () => {
    await inTx(async (c) => {
      const session = await actAs(c, AUTH.ivy);
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(2);

      // Supabase Auth deletes the session row on sign-out; the JWT itself is unchanged.
      await asOwner(c, "delete from auth.sessions where id = $1", [session]);
      await actAs(c, AUTH.ivy, { sessionId: session });

      for (const table of ["properties", "evidence", "organisations", "memberships", "users", "audit_events"]) {
        expect((await c.query(`select 1 from public.${table}`)).rowCount, table).toBe(0);
      }
    });
  });

  it("a signed-out session cannot write", async () => {
    await inTx(async (c) => {
      const session = await actAs(c, AUTH.ivy);
      await asOwner(c, "delete from auth.sessions where id = $1", [session]);
      await actAs(c, AUTH.ivy, { sessionId: session });
      await expect(
        c.query("insert into public.properties (owner_org_id, address) values ($1, '1 Ghost St')", [ORG.harbourview]),
      ).rejects.toThrow(RLS_VIOLATION);
    });
  });

  it("a signed-out session cannot create an organisation", async () => {
    await inTx(async (c) => {
      const session = await actAs(c, AUTH.pat);
      await asOwner(c, "delete from auth.sessions where id = $1", [session]);
      await actAs(c, AUTH.pat, { sessionId: session });
      await expect(c.query("select public.create_organisation('Ghost Pty Ltd', 'investor')")).rejects.toThrow(
        /not authenticated/,
      );
    });
  });

  it("other sessions of the same user keep working", async () => {
    await inTx(async (c) => {
      const laptop = await actAs(c, AUTH.ivy);
      const phone = await actAs(c, AUTH.ivy);
      await asOwner(c, "delete from auth.sessions where id = $1", [laptop]);
      await actAs(c, AUTH.ivy, { sessionId: phone });
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(2);
    });
  });

  it("a token without a session id is denied", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy, { sessionId: null });
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(0);
    });
  });

  it("a session past its not_after limit is denied", async () => {
    await inTx(async (c) => {
      const session = await actAs(c, AUTH.ivy);
      await asOwner(c, "update auth.sessions set not_after = now() - interval '1 minute' where id = $1", [session]);
      await actAs(c, AUTH.ivy, { sessionId: session });
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(0);
    });
  });

  it("another user's session id cannot be borrowed", async () => {
    await inTx(async (c) => {
      const oscarSession = await actAs(c, AUTH.oscar);
      await actAs(c, AUTH.ivy, { sessionId: oscarSession });
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(0);
    });
  });
});

describe("demo data safeguards", () => {
  it("the Halekulani demo property is flagged as demo with only unverified evidence", async () => {
    await as(AUTH.ivy, async (c) => {
      const p = await c.query("select address, suburb, is_demo, lot_dp from public.properties where id = $1", [PROPERTY.sharedActive]);
      expect(p.rows[0]).toEqual({ address: "76 Sunrise Avenue", suburb: "Halekulani", is_demo: true, lot_dp: null });
      const ev = await c.query(
        "select distinct verification_status, is_demo from public.evidence where property_id = $1",
        [PROPERTY.sharedActive],
      );
      expect(ev.rows).toEqual([{ verification_status: "unverified", is_demo: true }]);
    });
  });

  it("seed contains no verified evidence anywhere", async () => {
    await inTx(async (c) => {
      const r = await c.query("select 1 from public.evidence where verification_status = 'verified'");
      expect(r.rowCount).toBe(0);
    });
  });

  it("demo evidence can never be marked verified", async () => {
    await expect(
      as(AUTH.ivy, (c) =>
        c.query("update public.evidence set verification_status = 'verified' where id = $1", [EVIDENCE.demoPlanningCertificate]),
      ),
    ).rejects.toThrow(/evidence_demo_never_verified/);
  });

  it("users cannot clear the demo flag", async () => {
    await as(AUTH.ivy, async (c) => {
      const { rows } = await c.query("update public.properties set is_demo = false where id = $1 returning is_demo", [
        PROPERTY.sharedActive,
      ]);
      expect(rows[0].is_demo).toBe(true);
      const ev = await c.query("update public.evidence set is_demo = false where id = $1 returning is_demo", [
        EVIDENCE.demoPlanningCertificate,
      ]);
      expect(ev.rows[0].is_demo).toBe(true);
    });
  });

  it("evidence added to a demo property is itself demo (and so unverifiable)", async () => {
    await as(AUTH.ivy, async (c) => {
      const { rows } = await c.query(
        "insert into public.evidence (property_id, title, source_type, source_url, fetched_at, is_demo) values ($1, 'x', 'other', 'https://example.com/x', current_date, false) returning is_demo",
        [PROPERTY.sharedActive],
      );
      expect(rows[0].is_demo).toBe(true);
    });
  });

  it("users cannot create demo-flagged records themselves", async () => {
    await as(AUTH.ivy, async (c) => {
      const { rows } = await c.query(
        "insert into public.properties (owner_org_id, address, is_demo) values ($1, '9 Flag St', true) returning is_demo",
        [ORG.harbourview],
      );
      expect(rows[0].is_demo).toBe(false);
    });
  });
});

describe("matter-level grants", () => {
  it("granted professional can read the shared property, matter documents and findings", async () => {
    await as(AUTH.connie, async (c) => {
      expect(await ids(c, "select id from public.properties")).toEqual([PROPERTY.sharedActive]);
      expect(await ids(c, "select id from public.documents")).toEqual([DOCUMENT.matterContract]);
      const findings = await c.query("select 1 from public.findings");
      expect(findings.rowCount).toBe(2);
    });
  });

  it("granted professional can read the shared property's evidence register, but not edit it", async () => {
    await as(AUTH.connie, async (c) => {
      const ev = await c.query("select 1 from public.evidence where property_id = $1", [PROPERTY.sharedActive]);
      expect(ev.rowCount).toBe(3);
      const upd = await c.query("update public.evidence set notes = 'x' where property_id = $1", [PROPERTY.sharedActive]);
      expect(upd.rowCount).toBe(0);
      const other = await c.query("select 1 from public.evidence where property_id = $1", [PROPERTY.invitedOnly]);
      expect(other.rowCount).toBe(0);
    });
  });

  it("firm members without a grant cannot read the evidence register", async () => {
    await as(AUTH.sam, async (c) => {
      expect((await c.query("select 1 from public.evidence")).rowCount).toBe(0);
    });
  });

  it("an invitation alone grants no access to the property", async () => {
    await as(AUTH.connie, async (c) => {
      const r = await c.query("select 1 from public.properties where id = $1", [PROPERTY.invitedOnly]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("documents not attached to the matter stay private", async () => {
    await as(AUTH.connie, async (c) => {
      const r = await c.query("select 1 from public.documents where id = $1", [DOCUMENT.privateNotes]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("firm members see firm matters but not client files without an explicit grant", async () => {
    await as(AUTH.sam, async (c) => {
      expect(await ids(c, "select id from public.matters")).toEqual([MATTER.invited, MATTER.active].sort());
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(0);
      expect((await c.query("select 1 from public.documents")).rowCount).toBe(0);
      expect((await c.query("select 1 from public.findings")).rowCount).toBe(0);
    });
  });

  it("revoking the matter removes the professional's access", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      const r = await c.query("update public.matters set status = 'revoked' where id = $1", [MATTER.active]);
      expect(r.rowCount).toBe(1);
      await actAs(c, AUTH.connie);
      expect((await c.query("select 1 from public.documents")).rowCount).toBe(0);
      expect((await c.query("select 1 from public.properties")).rowCount).toBe(0);
    });
  });

  it("deleting the grant removes the professional's access", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      await c.query("delete from public.matter_access where matter_id = $1 and user_id = $2", [MATTER.active, USER.connie]);
      await actAs(c, AUTH.connie);
      expect((await c.query("select 1 from public.documents")).rowCount).toBe(0);
    });
  });

  it("investors can only grant access to members of the engaged firm", async () => {
    await expect(
      as(AUTH.ivy, (c) =>
        c.query("insert into public.matter_access (matter_id, user_id, permission) values ($1, $2, 'manage')", [
          MATTER.active,
          USER.oscar,
        ]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it("professionals cannot grant themselves access", async () => {
    await expect(
      as(AUTH.sam, (c) =>
        c.query("insert into public.matter_access (matter_id, user_id, permission) values ($1, $2, 'manage')", [
          MATTER.active,
          USER.sam,
        ]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });
});

describe("matter lifecycle", () => {
  it("firm admin can accept an invitation", async () => {
    await as(AUTH.connie, async (c) => {
      const r = await c.query("update public.matters set status = 'active' where id = $1 returning status", [MATTER.invited]);
      expect(r.rows[0].status).toBe("active");
    });
  });

  it("firm members who are not admins cannot accept", async () => {
    await as(AUTH.sam, async (c) => {
      const r = await c.query("update public.matters set status = 'active' where id = $1", [MATTER.invited]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("the investor cannot accept on the firm's behalf", async () => {
    await expect(
      as(AUTH.ivy, (c) => c.query("update public.matters set status = 'active' where id = $1", [MATTER.invited])),
    ).rejects.toThrow(/cannot move from invited to active|row-level security/);
  });

  it("a revoked matter cannot be re-activated by the firm", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      await c.query("update public.matters set status = 'revoked' where id = $1", [MATTER.active]);
      await actAs(c, AUTH.connie);
      await expect(
        c.query("update public.matters set status = 'active' where id = $1", [MATTER.active]),
      ).rejects.toThrow(/cannot move from revoked to active/);
    });
  });

  it("only the property owner's organisation can invite a firm", async () => {
    await expect(
      as(AUTH.oscar, (c) =>
        c.query(
          "insert into public.matters (property_id, investor_org_id, professional_org_id) values ($1, $2, $3)",
          [PROPERTY.invitedOnly, ORG.westside, ORG.firm],
        ),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });
});

describe("AI findings review", () => {
  it("granted professional can confirm a finding; reviewer is stamped by the server", async () => {
    await as(AUTH.connie, async (c) => {
      const { rows } = await c.query(
        "update public.findings set status = 'confirmed', reviewer_note = 'Checked p3' where id = $1 returning reviewer_id, reviewed_at",
        [FINDING.settlement],
      );
      expect(rows[0].reviewer_id).toBe(USER.connie);
      expect(rows[0].reviewed_at).not.toBeNull();
    });
  });

  it("reviewers cannot alter the AI-extracted text", async () => {
    await expect(
      as(AUTH.connie, (c) =>
        c.query("update public.findings set extracted_text = 'edited' where id = $1", [FINDING.settlement]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("investors cannot mark findings as professionally confirmed", async () => {
    await as(AUTH.ivy, async (c) => {
      const r = await c.query("update public.findings set status = 'confirmed' where id = $1", [FINDING.settlement]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("end users cannot insert findings (AI pipeline only)", async () => {
    await expect(
      as(AUTH.connie, (c) =>
        c.query(
          "insert into public.findings (document_id, category, extracted_text, page_ref) values ($1, 'x', 'y', 1)",
          [DOCUMENT.matterContract],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("platform administrators", () => {
  it("have no implicit access to client data", async () => {
    await as(AUTH.pat, async (c) => {
      for (const table of ["properties", "documents", "findings", "matters", "evidence", "organisations"]) {
        const r = await c.query(`select 1 from public.${table}`);
        expect(r.rowCount, table).toBe(0);
      }
    });
  });
});

describe("organisations and memberships", () => {
  it("create_organisation makes the caller admin and opens a free plan", async () => {
    await as(AUTH.pat, async (c) => {
      const { rows } = await c.query("select public.create_organisation('Pat Pty Ltd', 'investor') as id");
      const org = rows[0].id;
      const m = await c.query("select role from public.memberships where organisation_id = $1", [org]);
      const s = await c.query("select plan from public.subscriptions where organisation_id = $1", [org]);
      expect(m.rows[0].role).toBe("admin");
      expect(s.rows[0].plan).toBe("explorer");
    });
  });

  it("organisations cannot be created directly or self-verified", async () => {
    await expect(
      as(AUTH.ivy, (c) => c.query("insert into public.organisations (name, type) values ('x', 'investor')")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(AUTH.connie, (c) =>
        c.query("update public.organisations set verification_status = 'verified' where id = $1", [ORG.firm]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("non-admin members cannot add members", async () => {
    await expect(
      as(AUTH.sam, (c) =>
        c.query("insert into public.memberships (user_id, organisation_id, role) values ($1, $2, 'admin')", [
          USER.oscar,
          ORG.firm,
        ]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it("admins cannot remove or demote themselves (no orphaned organisations)", async () => {
    await as(AUTH.ivy, async (c) => {
      const del = await c.query("delete from public.memberships where user_id = $1", [USER.ivy]);
      const upd = await c.query("update public.memberships set role = 'member' where user_id = $1", [USER.ivy]);
      expect(del.rowCount).toBe(0);
      expect(upd.rowCount).toBe(0);
    });
  });

  it("members cannot change their own subscription", async () => {
    await expect(
      as(AUTH.ivy, (c) => c.query("update public.subscriptions set plan = 'developer'")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("nationwide workspaces (Blueprint v2.0)", () => {
  it.each(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"])("accepts a %s property", async (state) => {
    await as(AUTH.ivy, async (c) => {
      const { rows } = await c.query(
        "insert into public.properties (owner_org_id, address, jurisdiction) values ($1, '1 Test St', $2) returning jurisdiction",
        [ORG.harbourview, state],
      );
      expect(rows[0].jurisdiction).toBe(state);
    });
  });

  it("still defaults to NSW and keeps tenant isolation for other states", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      const { rows } = await c.query(
        "insert into public.properties (owner_org_id, address, jurisdiction) values ($1, '9 Perth St', 'WA') returning id",
        [ORG.harbourview],
      );
      const dflt = await c.query("insert into public.properties (owner_org_id, address) values ($1, '2 Default St') returning jurisdiction", [
        ORG.harbourview,
      ]);
      expect(dflt.rows[0].jurisdiction).toBe("NSW");
      await actAs(c, AUTH.oscar);
      expect((await c.query("select 1 from public.properties where id = $1", [rows[0].id])).rowCount).toBe(0);
    });
  });
});

describe("personal workspace (Update Pack 1.1)", () => {
  it("creates one personal investor workspace on first call, then returns it", async () => {
    await as(AUTH.nina, async (c) => {
      const first = (await c.query("select public.ensure_personal_workspace() as id")).rows[0].id;
      const second = (await c.query("select public.ensure_personal_workspace() as id")).rows[0].id;
      expect(second).toBe(first);
      const org = await c.query("select name, type from public.organisations where id = $1", [first]);
      expect(org.rows[0]).toEqual({ name: "Nina Newbuyer's workspace", type: "investor" });
      const m = await c.query("select role from public.memberships where user_id = $1", [USER.nina]);
      expect(m.rows).toEqual([{ role: "admin" }]);
      const sub = await c.query("select plan from public.subscriptions where organisation_id = $1", [first]);
      expect(sub.rows[0].plan).toBe("explorer");
    });
  });

  it("returns the existing organisation for users who already have one", async () => {
    await as(AUTH.connie, async (c) => {
      const { rows } = await c.query("select public.ensure_personal_workspace() as id");
      expect(rows[0].id).toBe(ORG.firm);
      expect((await c.query("select 1 from public.memberships where user_id = $1", [USER.connie])).rowCount).toBe(1);
    });
  });

  it("the new workspace is isolated from other tenants", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.nina);
      const org = (await c.query("select public.ensure_personal_workspace() as id")).rows[0].id;
      await c.query("insert into public.properties (owner_org_id, address) values ($1, '1 Nina St')", [org]);
      await actAs(c, AUTH.ivy);
      expect((await c.query("select 1 from public.properties where owner_org_id = $1", [org])).rowCount).toBe(0);
    });
  });

  it("anonymous and signed-out callers are refused", async () => {
    await expect(as(null, (c) => c.query("select public.ensure_personal_workspace()"))).rejects.toThrow(/permission denied/);
    await expect(
      inTx(async (c) => {
        const session = await actAs(c, AUTH.nina);
        await asOwner(c, "delete from auth.sessions where id = $1", [session]);
        await actAs(c, AUTH.nina, { sessionId: session });
        await c.query("select public.ensure_personal_workspace()");
      }),
    ).rejects.toThrow(/not authenticated/);
  });
});

describe("audit trail", () => {
  it("records writes, visible to the organisation's admins only", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      const { rows } = await c.query(
        "insert into public.properties (owner_org_id, address) values ($1, '77 Audit Lane') returning id",
        [ORG.harbourview],
      );
      const ev = await c.query(
        "select actor_id, action from public.audit_events where resource_type = 'properties' and resource_id = $1",
        [rows[0].id],
      );
      expect(ev.rows).toEqual([{ actor_id: USER.ivy, action: "insert" }]);

      await actAs(c, AUTH.oscar);
      const leaked = await c.query("select 1 from public.audit_events where organisation_id = $1", [ORG.harbourview]);
      expect(leaked.rowCount).toBe(0);
    });
  });

  it("end users cannot write or erase audit events", async () => {
    await expect(
      as(AUTH.ivy, (c) =>
        c.query("insert into public.audit_events (resource_type, action) values ('x', 'forged')"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(as(AUTH.ivy, (c) => c.query("delete from public.audit_events"))).rejects.toThrow(/permission denied/);
  });
});

describe("scenarios and report exports", () => {
  it("scenario results are append-only (history can't be edited or erased)", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      const sc = await c.query(
        "insert into public.scenarios (property_id, name, formula_version) values ($1, 'Duplex', 'feasibility-1.0.0') returning id",
        [PROPERTY.sharedActive],
      );
      await c.query("insert into public.scenario_results (scenario_id, result_json, formula_version) values ($1, '{}', 'feasibility-1.0.0')", [
        sc.rows[0].id,
      ]);
      await expect(c.query("update public.scenario_results set result_json = '{\"forged\":true}'")).rejects.toThrow(/permission denied/);
    });
    await expect(as(AUTH.ivy, (c) => c.query("delete from public.scenario_results"))).rejects.toThrow(/permission denied/);
  });

  it("another tenant cannot attach results to someone else's scenario", async () => {
    await inTx(async (c) => {
      await actAs(c, AUTH.ivy);
      const sc = await c.query(
        "insert into public.scenarios (property_id, name, formula_version) values ($1, 'Private', 'feasibility-1.0.0') returning id",
        [PROPERTY.sharedActive],
      );
      await actAs(c, AUTH.oscar);
      await expect(
        c.query("insert into public.scenario_results (scenario_id, result_json, formula_version) values ($1, '{}', 'x')", [sc.rows[0].id]),
      ).rejects.toThrow(RLS_VIOLATION);
    });
  });

  it("records a report export in the owner's audit log", async () => {
    await as(AUTH.ivy, async (c) => {
      await c.query("select public.record_report_export($1, 'html')", [PROPERTY.sharedActive]);
      const { rows } = await c.query(
        "select actor_id, action, metadata from public.audit_events where resource_id = $1 and action = 'report.exported'",
        [PROPERTY.sharedActive],
      );
      expect(rows).toEqual([{ actor_id: USER.ivy, action: "report.exported", metadata: { format: "html" } }]);
    });
  });

  it("refuses report exports for properties the caller doesn't own", async () => {
    await expect(
      as(AUTH.oscar, (c) => c.query("select public.record_report_export($1, 'html')", [PROPERTY.sharedActive])),
    ).rejects.toThrow(/not permitted/);
    // A granted conveyancer can read the property but the feasibility report is the investor's.
    await expect(
      as(AUTH.connie, (c) => c.query("select public.record_report_export($1, 'html')", [PROPERTY.sharedActive])),
    ).rejects.toThrow(/not permitted/);
  });

  it("rejects unknown export formats", async () => {
    await expect(
      as(AUTH.ivy, (c) => c.query("select public.record_report_export($1, 'exe')", [PROPERTY.sharedActive])),
    ).rejects.toThrow(/unsupported export format/);
  });

  it("anonymous users cannot record exports", async () => {
    await expect(
      as(null, (c) => c.query("select public.record_report_export($1, 'html')", [PROPERTY.sharedActive])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("storage", () => {
  it("private document objects are readable only via document access", async () => {
    await inTx(async (c) => {
      await c.query("insert into storage.objects (bucket_id, name) values ('documents', $1)", [
        `${ORG.harbourview}/${DOCUMENT.matterContract}.pdf`,
      ]);
      await actAs(c, AUTH.connie);
      expect((await c.query("select 1 from storage.objects")).rowCount).toBe(1);
      await actAs(c, AUTH.oscar);
      expect((await c.query("select 1 from storage.objects")).rowCount).toBe(0);
    });
  });

  it("users cannot upload into another organisation's folder", async () => {
    await expect(
      as(AUTH.oscar, (c) =>
        c.query("insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${ORG.harbourview}/evil.pdf`]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });
});
