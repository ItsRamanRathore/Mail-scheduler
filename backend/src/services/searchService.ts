import MiniSearch from 'minisearch';
import { db } from '../db';

export interface EmailSearchDoc {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  status: string;
  scheduled_at: number;
  sent_at?: number | null;
  preview_url?: string | null;
}

class SearchService {
  private miniSearch: MiniSearch<EmailSearchDoc>;
  private indexedCount = 0;

  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['recipient', 'sender', 'subject', 'body', 'status'], // fields to search for
      storeFields: ['id', 'recipient', 'sender', 'subject', 'body', 'status', 'scheduled_at', 'sent_at', 'preview_url'], // fields to return
      searchOptions: {
        boost: { subject: 2, recipient: 1.5 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  public init() {
    // Populate index from SQLite database on boot
    const allEmails = db.prepare('SELECT * FROM emails').all() as EmailSearchDoc[];
    if (allEmails.length > 0) {
      this.miniSearch.addAll(allEmails);
      this.indexedCount = allEmails.length;
    }
    console.log(`🔍 Search engine indexed ${this.indexedCount} emails.`);
  }

  public indexEmail(doc: EmailSearchDoc) {
    if (this.miniSearch.has(doc.id)) {
      this.miniSearch.discard(doc.id);
    }
    this.miniSearch.add(doc);
  }

  public removeEmail(id: string) {
    if (this.miniSearch.has(id)) {
      this.miniSearch.discard(id);
    }
  }

  public search(query: string, status?: string): EmailSearchDoc[] {
    if (!query || query.trim() === '') {
      let sql = 'SELECT * FROM emails';
      const params: any[] = [];
      if (status) {
        if (status === 'scheduled') {
          sql += " WHERE status IN ('scheduled', 'rescheduled')";
        } else {
          sql += ' WHERE status = ?';
          params.push(status);
        }
      }
      sql += ' ORDER BY scheduled_at DESC LIMIT 100';
      return db.prepare(sql).all(...params) as EmailSearchDoc[];
    }

    const results = this.miniSearch.search(query);
    let matched = results.map((r) => ({
      id: r.id,
      recipient: r.recipient,
      sender: r.sender,
      subject: r.subject,
      body: r.body,
      status: r.status,
      scheduled_at: r.scheduled_at,
      sent_at: r.sent_at,
      preview_url: r.preview_url,
    }));

    if (status) {
      if (status === 'scheduled') {
        matched = matched.filter((e) => e.status === 'scheduled' || e.status === 'rescheduled');
      } else {
        matched = matched.filter((e) => e.status === status);
      }
    }

    return matched;
  }
}

export const searchService = new SearchService();
