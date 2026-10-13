// Choices used by the catalog forms. The courses, teachers and subjects themselves always come from the API.
export const DEPARTMENTS = ['College of Computing', 'College of Business', 'College of Engineering', 'College of Arts and Sciences']

export const opt = (v) => ({ value: v, label: v })

// Options for a select, always including the row's current value (so an older value is not lost on edit).
export const withCurrent = (values, current) => [...new Set([...values, ...(current ? [current] : [])])].map(opt)
