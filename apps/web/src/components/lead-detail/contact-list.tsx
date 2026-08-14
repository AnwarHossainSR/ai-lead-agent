import { Evidence } from "@/components/evidence";
import { Fact } from "@/components/fact";
import type { AccountSummary } from "@/lib/accounts";
import { resolveAccountEmail } from "@/lib/accounts";
import type { Contact } from "@/lib/lead-detail";

/**
 * Renders contacts. Email and phone link through `<Evidence>` when a source
 * is on record; a missing value renders `<Fact>`'s unknown marker rather
 * than an empty field.
 *
 * `accounts` resolves a do-not-contact marker's account id to an email
 * (task 8.5, dashboard spec: "a do-not-contact marker shows who set it");
 * defaults to empty so a caller with nothing marked doesn't need to fetch it.
 */
export function ContactList({
  contacts,
  accounts = [],
}: {
  contacts: readonly Contact[];
  accounts?: readonly AccountSummary[];
}) {
  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">No contacts found.</p>;
  }

  return (
    <ul className="space-y-3">
      {contacts.map((contact) => (
        <li key={contact.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Fact
              fact={{ certainty: contact.certainty, value: contact.name }}
              className="font-medium"
            />
            {contact.jobTitle && (
              <span className="text-sm text-muted-foreground">{contact.jobTitle}</span>
            )}
          </div>
          {contact.doNotContactAt && (
            <div
              role="alert"
              className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2"
            >
              <p className="text-sm font-medium text-destructive">Do not contact</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {contact.doNotContactReason ?? "No reason recorded."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Marked by{" "}
                {resolveAccountEmail(accounts, contact.doNotContactByAccountId) ??
                  "an account (email unavailable)"}{" "}
                at {new Date(contact.doNotContactAt).toLocaleString()}
              </p>
            </div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              Email:{" "}
              {contact.email ? (
                contact.sourceUrl ? (
                  <Evidence
                    sourceUrl={contact.sourceUrl}
                    recordedAt={contact.createdAt}
                    detail={`Found via ${contact.researchSource}`}
                  >
                    {contact.email}
                  </Evidence>
                ) : (
                  contact.email
                )
              ) : (
                <Fact fact={{ certainty: "unknown" }} />
              )}
            </span>
            <span>
              Phone:{" "}
              {contact.phone ? (
                contact.sourceUrl ? (
                  <Evidence
                    sourceUrl={contact.sourceUrl}
                    recordedAt={contact.createdAt}
                    detail={`Found via ${contact.researchSource}`}
                  >
                    {contact.phone}
                  </Evidence>
                ) : (
                  contact.phone
                )
              ) : (
                <Fact fact={{ certainty: "unknown" }} />
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
