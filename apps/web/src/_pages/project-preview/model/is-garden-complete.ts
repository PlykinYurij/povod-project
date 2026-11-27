import type { ProjectDto } from "@shared/api";

export function isGardenComplete({ content, title }: ProjectDto): boolean {
  if ("celebrant" in content)
    return [
      title,
      content.celebrant,
      content.event.date,
      content.event.startTime,
      content.event.timeZone,
      content.venue.name,
      content.venue.address,
      content.copy.rsvpAction,
    ].every((value) => value.trim() !== "");
  if ("celebrantName" in content)
    return [
      title,
      content.celebrantName,
      content.event.date,
      content.event.startTime,
      content.event.timeZone,
      content.venue.name,
      content.venue.address,
      content.copy.rsvpAction,
    ].every((value) => value.trim() !== "");
  if ("photo" in content)
    return [
      title,
      content.names.first,
      content.names.second,
      content.event.date,
      content.event.startTime,
      content.event.timeZone,
      content.venue.name,
      content.venue.address,
      content.copy.rsvpAction,
    ].every((value) => value.trim() !== "");
  const { names, event, venue, program } = content;
  const required = [
    title,
    names.first,
    names.second,
    event.localDate,
    event.localTime,
    event.timeZone,
    venue.name,
    venue.address,
  ];
  return (
    required.every((value) => value.trim() !== "") &&
    (program === null ||
      (program.length > 0 &&
        program.every(({ time, text }) => time.trim() && text.trim())))
  );
}
