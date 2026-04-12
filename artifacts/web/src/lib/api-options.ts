export function getApiOptions() {
  const token =
    window.localStorage.getItem("repo-guardian-token") ||
    import.meta.env.VITE_API_SECRET_KEY ||
    "dev-secret-key-do-not-use-in-production";

  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
}
