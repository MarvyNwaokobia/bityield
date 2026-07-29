# Launch email setup (do this ~1 week before public launch)

> **Do not do this early.** Nothing here is needed to collect waitlist signups.
> That already works. This is only for the day you want to *send* an email to
> the people on the list.
>
> Budget 20 minutes, plus waiting time for DNS.

---

## What this is, in plain language

When you send an email to 500 strangers, Gmail has to decide: is this really
BitYield, or is it a scammer pretending to be BitYield? If Gmail can't tell, it
puts your email in spam and nobody sees your launch.

You prove it's really you by adding a few lines of text to your domain's
settings. Those lines are a signature only the real owner of `bityield.click`
could have added.

That's the entire job. Copy about 3 lines from Resend, paste them into Vercel.

**Why Vercel?** Because Vercel controls your domain's settings. Your domain's
nameservers are `ns1.vercel-dns.com` and `ns2.vercel-dns.com`, which is a
technical way of saying "Vercel is in charge of bityield.click". So that's where
the lines go. Not your registrar, not GoDaddy, not anywhere else. Vercel.

---

## Part 1: Tell Resend which name you'll send from

**1.** Go to **resend.com**, log in.

**2.** Click **Domains** in the left sidebar.

**3.** Click **Add Domain**.

**4.** In the **Name** box, type exactly:

```
updates.bityield.click
```

**Read this before you worry:** `updates.bityield.click` does not exist yet, and
that is completely fine. You are not looking up something that already exists.
You are *inventing* a name and claiming it. It becomes real in Part 2 when you
add the records. There is no website there, nothing to build, nothing to deploy.

**Why not just `bityield.click`?** Resend recommends against it, and they're
right. If an email ever gets marked as spam, the damage sticks to whatever name
sent it. Using `updates.bityield.click` means a spam problem hurts only that
name, and your actual product at `bityield.click` stays clean. Keep them
separate.

**5.** **Region:** pick the one closest to most of your users. If you're not
sure, pick the US one. This only affects speed, and it is not a big deal.

**6.** Click **Add Domain**.

Resend now shows you a table of **DNS Records**. Leave this tab open. You need
it for Part 2. It will look roughly like this:

| Type | Name | Value |
|------|------|-------|
| TXT  | `resend._domainkey.updates` | `p=MIGfMA0GCS...` (very long) |
| TXT  | `updates` | `v=spf1 include:amazonses.com ~all` |
| MX   | `updates` | `feedback-smtp.us-east-1.amazonses.com` |

The exact rows will differ. Yours are the ones that matter, not these examples.

---

## Part 2: Paste those records into Vercel

**7.** In a new tab go to **vercel.com** and log in.

**8.** Click **Domains** in the top navigation. (This is the account-level
Domains area, not your project's settings.)

**9.** Click on **bityield.click**.

**10.** Find the **DNS Records** section, and click **Add** / **Add Record**.

**11.** Now copy the records across, **one row at a time**. For each row in
Resend's table, fill in Vercel's form:

| Resend column | Goes into Vercel's field |
|---------------|--------------------------|
| Type          | Type (choose TXT or MX from the dropdown) |
| Name          | Name |
| Value         | Value |
| Priority      | Priority (MX rows only) |

Click Save, then repeat for the next row until every row from Resend exists in
Vercel.

### Three things that trip people up

- **Copy and paste. Never retype.** The DKIM value is a long random string. One
  wrong character and it silently fails, and you will not be able to spot it by
  eye.
- **Do not add `.bityield.click` to the Name field.** Vercel adds it
  automatically. If Resend says the name is `resend._domainkey.updates`, you type
  exactly `resend._domainkey.updates`. If you type
  `resend._domainkey.updates.bityield.click` you will accidentally create
  `resend._domainkey.updates.bityield.click.bityield.click`, which is wrong.
- **Watch for trailing spaces.** Copying often grabs a space at the end. Delete
  it.

---

## Part 3: Check it worked

**12.** Go back to the Resend tab and click **Verify** (or **Restart
verification**).

**13.** Wait. Usually it goes green in about 15 minutes. It can take up to 72
hours in the worst case, though that's rare. Refresh occasionally.

**14.** When every row shows **Verified**, you're done. You can now send from
`updates.bityield.click`.

**If it's still failing after a few hours,** the cause is almost always a typo
in one pasted value. Compare each Vercel row against Resend character by
character, or just delete the record in Vercel and paste it again fresh.

---

## Part 4: Actually send the launch email

**15.** In Resend, click **Broadcasts** in the sidebar, then create a new one.

**16.** Set the **From** address to something at your new subdomain:

```
BitYield <hello@updates.bityield.click>
```

**17.** ⚠️ **THE ONE THING YOU MUST NOT FORGET.** Put this exact text somewhere
in the email, usually at the bottom:

```
{{{RESEND_UNSUBSCRIBE_URL}}}
```

That turns into a working unsubscribe link. It is **legally required** for
marketing email under FTC rules and GDPR, and Resend does **not** add it for
you. Skip it and you are breaking the law, and people who can't unsubscribe hit
"spam" instead, which wrecks your ability to send anything ever again.

Three curly braces on each side. Not two.

**18.** Send yourself a test first. Check it doesn't land in spam.

**19.** Send the real one.

---

## Keep an eye on these numbers

Resend suspends your sending if you cross these:

| Metric | Limit |
|--------|-------|
| Bounce rate | under 4% |
| Spam complaints | under 0.08% |

Free tier covers up to **1,000 contacts**. If the waitlist grows past that, you
need a paid plan before you can email everyone.

---

## If the list has been sitting for a long time

If months passed between collecting these emails and launching, people will have
forgotten they signed up, and some will hit spam. Two protections:

- Open with a reminder: "You joined the BitYield waitlist on [date]. Here's the
  launch you asked to hear about."
- If it's been more than about 6 months, consider adding double opt-in to the
  signup form *before* collecting more addresses. Ask Claude to set it up.

---

## Reference

- Resend domain docs: https://resend.com/docs/add-a-domain
- Unsubscribe requirements: https://resend.com/docs/knowledge-base/should-i-add-an-unsubscribe-link
- The waitlist code: `app/lib/waitlist.ts`, `app/app/api/waitlist/route.ts`
- Env var needed (already set in Vercel and `.env.local`): `RESEND_API_KEY`
