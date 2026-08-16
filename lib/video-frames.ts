/**
 * Copy for /tools/video-frames. The FAQ lives here so the rendered <dl> and
 * the FAQPage JSON-LD read from one array and cannot drift — the same
 * arrangement as lib/checksum.ts, lib/qr.ts and lib/image-compress.ts.
 */

import type { FaqEntry } from './faq';

/**
 * Written for the long tail rather than for "video to jpg", which belongs to
 * sites with dozens of interlinked tools. What is actually different here is
 * size and privacy, so that is what the page is about.
 */
export const SUPPORTED_NOTE =
  'This tool uses the video support already built into your browser, which is what lets it work without uploading anything. MP4 and MOV files using H.264 — what phones, cameras and screen recorders produce by default — work, as do WebM files. AVI, WMV, FLV and older formats do not, and neither do some newer iPhone recordings saved as HEVC. Where a file cannot be read you are told immediately, and told why, rather than being left with a folder of blank images.';

export const WHY_LOCAL: readonly { title: string; body: string }[] = [
  {
    title: 'No upload, so no size limit.',
    body: 'Your video is read from disk by this page. Nothing is transferred, so there is no upload wait and nothing that has to fit through one — a 4 GB screen recording is the same to this tool as a 4 MB clip. The tools that run on a server have to cap what they accept; ezgif, the best of them, stops at 200 MB.',
  },
  {
    title: 'Nothing is left on anyone’s server.',
    body: 'A site that processes your video has to store it while it works, and then for some time afterwards — an hour is typical. That is a copy of your footage on a machine you do not control. Here there is no copy, because there was never a transfer.',
  },
  {
    title: 'It works on things you would not upload.',
    body: 'Screen recordings with credentials on screen, footage of your family, unreleased work, anything under an agreement about where it may be stored. The question of whether the site is trustworthy does not arise when the file does not leave the device.',
  },
  {
    title: 'The trade-off, stated plainly.',
    body: 'Server-side tools run ffmpeg, so they read every format ever made and can pull every frame with exact accuracy. This one is limited to what your browser can decode, and seeks to a timestamp rather than to a numbered frame. For pulling stills out of ordinary footage that difference does not matter; for frame-exact work on an unusual codec, it does.',
  },
];

export const HOW_TO: readonly { title: string; body: string }[] = [
  {
    title: 'Choose the video.',
    body: 'It is read on this device. Large files are fine — nothing is uploaded, so there is no wait before you can start.',
  },
  {
    title: 'Narrow the range if you only want part of it.',
    body: 'Set a start and end time. This is what makes a high frame rate usable: twelve frames a second across ten seconds is a reasonable set of images, and across ten minutes it is not.',
  },
  {
    title: 'Pick a frame rate.',
    body: 'One frame a second is right for reviewing a long recording. Higher rates are for catching a moment — a facial expression, a ball crossing a line, the frame a fault appears in. The number of images is shown before extraction starts.',
  },
  {
    title: 'Take them individually or as one ZIP.',
    body: 'A single frame downloads on its own. More than one comes as a ZIP, because browsers block repeated downloads. The images are stored in the archive without further compression, since JPEG data does not compress again.',
  },
];

export const VIDEO_FRAMES_FAQ: readonly FaqEntry[] = [
  {
    q: 'Is my video uploaded anywhere?',
    a: 'No. The video is read from your disk by this page and every frame is produced on your device. Nothing is sent to us or to anyone else, and no request leaves the browser while it works. You can disconnect from the network and the tool still works.',
  },
  {
    q: 'Is there a size limit?',
    a: 'No. Because there is no upload, file size is not a constraint the way it is for a site that has to receive your video first — those commonly cap at a few hundred megabytes. What limits this tool is the number of frames you ask for, not the size of the file they come from.',
  },
  {
    q: 'Which video formats work?',
    a: 'This tool uses the video support already built into your browser, which is what lets it work without uploading anything. MP4 and MOV files using H.264 — what phones, cameras and screen recorders produce by default — work, as do WebM files. AVI, WMV, FLV and older formats do not, and neither do some newer iPhone recordings saved as HEVC. Where a file cannot be read you are told immediately, and told why, rather than being left with a folder of blank images.',
  },
  {
    q: 'Why can I not extract every single frame?',
    a: 'Because a five-minute clip at thirty frames a second is nine thousand images, which is a folder nobody will look through and enough work to make the tab unresponsive. Choosing a frame rate and a time range gets you the moment you actually wanted. The tool caps a single run at 600 frames and tells you the count before it starts.',
  },
  {
    q: 'Will a video shot on a phone come out sideways?',
    a: 'No. Phone videos are often recorded in one orientation and tagged to be displayed in another, and the frames here are drawn the way the video is displayed, so a portrait recording produces portrait images.',
  },
  {
    q: 'Are the frames exactly the ones in the video?',
    a: 'They are the frames the browser shows at the timestamps requested, which for ordinary footage is the frame you would see if you paused there. It is not the same as numbering every frame in the file and pulling frame 1,247 — that needs a full decoder, which is what server-side tools run and what would mean downloading tens of megabytes of code to this page.',
  },
];
