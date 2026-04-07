export const APP_LOGO = "https://upload.wikimedia.org/wikipedia/id/a/a2/Logo_GP_Ansor.png";

export const padPassword = (password: string): string => {
  if (password.length >= 6) return password;
  // Pad with a secret suffix to reach at least 6 characters
  return password + "_simak_pad"; 
};
