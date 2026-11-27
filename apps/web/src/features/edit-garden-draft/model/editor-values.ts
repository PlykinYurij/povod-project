import type {
  GardenContentDto,
  GardenCopyDto,
  ProjectDto,
  SaveProjectDraftDto,
} from "@shared/api";

export type GardenEditorValues = {
  title: string;
  programEnabled: boolean;
  content: Omit<GardenContentDto, "program"> & {
    program: NonNullable<GardenContentDto["program"]>;
  };
};

export const copyLimits = {
  invitationLabel: 80,
  namesConnector: 16,
  introduction: 4000,
  detailsTitle: 160,
  whenLabel: 80,
  whereLabel: 80,
  startTimeLabel: 80,
  timeZoneLabel: 80,
  routeLabel: 80,
  programEyebrow: 80,
  programTitle: 160,
  rsvpEyebrow: 80,
  rsvpTitle: 160,
  footerText: 1000,
} satisfies Record<keyof GardenCopyDto, number>;

export function toEditorValues(project: ProjectDto): GardenEditorValues {
  if (!("program" in project.content))
    throw new Error("Unexpected invitation schema for the Garden editor");
  const { program, ...content } = project.content;
  return {
    title: project.title,
    programEnabled: program !== null,
    content: { ...content, program: program ?? [] },
  };
}

export function toSaveRequest(
  values: GardenEditorValues,
  expectedRevision: number,
): SaveProjectDraftDto {
  return {
    title: values.title,
    expectedRevision,
    content: {
      ...values.content,
      program: values.programEnabled ? values.content.program : null,
    },
  };
}
