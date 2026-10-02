import type { GetServerSideProps } from 'next';
import fs from 'fs';
import path from 'path';

// The employee/contractor conversational joiner is a single self-contained
// static file (public/index.html) rather than a React page — serving it at
// `/` (not `/index.html`) means streaming its raw bytes directly from here.
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write(html);
  res.end();
  return { props: {} };
};

export default function Index() {
  return null;
}
