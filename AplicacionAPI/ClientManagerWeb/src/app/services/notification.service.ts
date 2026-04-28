import { Injectable } from '@angular/core';

export interface StoredNotif {
  icon: string;
  iconColor: string;
  text: string;
  sub: string;
  date: string;
}

const KEY      = 'cm-notifications';
const SEEN_KEY = 'cm-notifications-seen';
const MAX      = 10;

@Injectable({ providedIn: 'root' })
export class NotificationService {

  add(n: StoredNotif): void {
    const current = this.getAll();
    const updated = [n, ...current].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  }

  getAll(): StoredNotif[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  getUnreadCount(): number {
    const seenAt = localStorage.getItem(SEEN_KEY);
    if (!seenAt) return this.getAll().length;
    const seenDate = new Date(seenAt).getTime();
    return this.getAll().filter(n => new Date(n.date).getTime() > seenDate).length;
  }

  markAsSeen(): void {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  }
}
