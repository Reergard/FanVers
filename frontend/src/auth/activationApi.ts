import { httpRaw } from "../api/httpRaw";
import { API } from "../api/endpoints";

export async function resendActivation(email: string) {
  return httpRaw.post(API.resendActivation, { email });
}

