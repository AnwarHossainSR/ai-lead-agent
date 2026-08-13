import { Evidence } from "@/components/evidence";
import { Fact } from "@/components/fact";
import type { Contact } from "@/lib/lead-detail";

/**
 * Renders contacts. Email and phone link through `<Evidence>` when a source
 * is on record; a missing value renders `<Fact>`'s unknown marker rather
 * than an empty field.
 */
export function ContactList({ contacts }: { contacts: readonly Contact[] }) {
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
