import { useAuth } from "../auth/useAuth";
import type { Book, Chapter, Volume } from "../api/catalogApi";

interface BookDetailReaderProps {
  book: Book;
  volumes: Volume[];
  chapters: Chapter[];
}

export default function BookDetailReader({
  book,
  volumes,
  chapters,
}: BookDetailReaderProps) {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <div>Reader mode: {book.title}</div>
      <div>Authenticated: {String(isAuthenticated)}</div>
      <div>Volumes: {volumes.length}</div>
      <div>Chapters: {chapters.length}</div>
    </div>
  );
}
