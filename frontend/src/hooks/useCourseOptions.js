import { useApiList } from './useApiList'

// The course catalog as the dropdowns need it, read from the API (so a course added in Courses appears everywhere).
export function useCourseOptions() {
  const { rows, loading, error } = useApiList('/courses')
  return {
    codes: rows.map((c) => c.code),
    options: rows.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` })),
    loading,
    error,
  }
}
