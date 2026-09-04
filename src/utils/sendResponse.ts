import { Response } from 'express';

export interface IApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export const sendResponse = <T>(
  res: Response,
  data: {
    statusCode: number;
    success: boolean;
    message: string;
    data?: T;
    errors?: any[];
  }
): void => {
  const responseBody: IApiResponse<T> = {
    success: data.success,
    message: data.message,
  };

  if (data.data !== undefined) {
    responseBody.data = data.data;
  }

  if (data.errors !== undefined) {
    responseBody.errors = data.errors;
  }

  res.status(data.statusCode).json(responseBody);
};
