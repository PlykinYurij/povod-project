import type { ProjectDto } from "@shared/api";

export function isGardenComplete({ content, title }: ProjectDto): boolean {
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
