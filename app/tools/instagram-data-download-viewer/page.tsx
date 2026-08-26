import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/ContentPageShell';
import { InstagramExportTool } from '@/components/InstagramExportTool';
import { pageMetadata } from '@/lib/seo';

const PATH = '/tools/instagram-data-download-viewer';
const TITLE = 'Instagram Data Download Viewer — read your export in the browser';
const DESCRIPTION =
  'Open the zip Instagram sends you and read your messages, without extracting it and without uploading it anywhere.';

export const metadata: Metadata = pageMetadata({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function Page() {
  return (
    <ContentPageShell
      breadcrumbName="Instagram data download viewer"
      path={PATH}
      title="Instagram data download viewer"
      subhead="Under construction — excluded from the sitemap until it works."
      tool={<InstagramExportTool />}
    >
      <section className="glass card p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">Phase 1 in progress.</p>
      </section>
    </ContentPageShell>
  );
}
