/**
 * Copy that appears in more than one place.
 *
 * The animated demo on the landing page reproduces the start screen in
 * miniature. Two copies of the same sentence drift apart the first time one is
 * reworded, and the drift is invisible — the demo would simply advertise a UI
 * we no longer ship. Both render from here instead.
 *
 * Only add a string here once a second caller exists. Copy used in one place
 * belongs next to the markup that shows it.
 */

export const SEND_HEADING = 'Send something';
export const SEND_BODY =
  'Start a session on this device, then open Mubifiles on the other one and enter the code.';

export const RECEIVE_HEADING = 'Receive something';
export const RECEIVE_BODY = 'Enter the 6-digit code shown on the other device.';

export const ONE_SHOT_LABEL = 'One-time download';
export const ONE_SHOT_HINT = "Each file can be downloaded once, then it's gone.";

export const START_ACTION = 'Start a session';
export const CONNECT_ACTION = 'Connect';
