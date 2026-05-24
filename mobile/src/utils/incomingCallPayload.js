/** Payload i përkohshëm për thirrje hyrëse (shmang limitet e route params për SDP). */
let pending = null;

export function setPendingIncomingCall(payload) {
  pending = payload;
}

export function consumePendingIncomingCall() {
  const p = pending;
  pending = null;
  return p;
}
