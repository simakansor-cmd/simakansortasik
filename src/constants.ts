export const APP_LOGO = "https://ansor.id/images/logo_ansor.png";

export const padPassword = (password: string): string => {
  if (password.length >= 6) return password;
  // Pad with a secret suffix to reach at least 6 characters
  return password + "_simak_pad"; 
};
