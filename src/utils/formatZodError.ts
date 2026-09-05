import { ZodError } from 'zod';

export interface IFormattedError {
  field: string;
  message: string;
}

/**
 * Formats Zod validation issues into a clean array of { field, message } error objects.
 * When encountering 'unrecognized_keys', it splits the keys array into separate
 * per-field error entries (e.g. field: "email", message: "Unrecognized field").
 */
export const formatZodError = (error: ZodError): IFormattedError[] => {
  const formatted: IFormattedError[] = [];

  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      const basePath = issue.path.join('.');
      for (const key of issue.keys) {
        const fieldName = basePath ? `${basePath}.${key}` : key;
        formatted.push({
          field: fieldName,
          message: 'Unrecognized field',
        });
      }
    } else {
      formatted.push({
        field: issue.path.join('.'),
        message: issue.message,
      });
    }
  }

  return formatted;
};
