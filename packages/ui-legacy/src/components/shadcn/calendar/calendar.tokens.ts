export const calendarTokenNames = {
  background: "--ui-calendar-background",
  foreground: "--ui-calendar-foreground",
  borderColor: "--ui-calendar-border-color",
  radius: "--ui-calendar-radius",
} as const;

export type CalendarToken =
  (typeof calendarTokenNames)[keyof typeof calendarTokenNames];
