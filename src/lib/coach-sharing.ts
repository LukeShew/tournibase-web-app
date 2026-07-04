export function getCoachSharePath(eventSlug: string) {
  return `/share/${eventSlug}`;
}

export function getPublicTicketPath(eventSlug: string) {
  return `/e/${eventSlug}`;
}

export function buildParentMessage(ticketUrl: string) {
  return `Parents and spectators can buy tournament admission ahead of time here:

${ticketUrl}

Buying ahead helps you skip the gate line. Show your digital pass when you arrive.`;
}
