export interface RSSEntry {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

export interface LikeCount {
  entryLink: string;
  count: number;
}

export interface CommentCount {
  entryLink: string;
  count: number;
}

export interface RSSFeedData {
  entries: RSSEntry[];
  likes: Record<string, number>;
  comments: Record<string, number>;
}

// Type definitions for database operations

import { RowDataPacket, ResultSetHeader, FieldPacket } from 'mysql2/promise';

// MySQL query result types
export type MySQLRowDataPacket = RowDataPacket;
export type MySQLResultSetHeader = ResultSetHeader;
export type MySQLQueryResult = [MySQLRowDataPacket[], FieldPacket[]];

// RSS Feed types
export interface RSSFeedRow {
  id: number;
  feed_url: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface RSSEntryRow {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  created_at: number;
}

// API response types
export interface APIResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

// XML parsing types
export interface XMLParseResult {
  rss?: {
    channel?: {
      title?: string;
      link?: string;
      description?: string;
      item?: Record<string, unknown>[] | Record<string, unknown>;
    };
  };
  feed?: {
    title?: string;
    link?: string | { "@_href": string }[];
    entry?: Record<string, unknown>[] | Record<string, unknown>;
  };
} 