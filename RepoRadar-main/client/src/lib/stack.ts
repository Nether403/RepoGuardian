// Stack Auth configuration for Neon Auth
export const stackConfig = {
  projectId: import.meta.env.VITE_STACK_PROJECT_ID || "c74a78dc-8038-4049-a29b-a5cb9cdda766",
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_KEY || "pck_b0bpef6d3tbbth6rt258zbtwqx22gdgedej0xdwbt5j18",
  signInUrl: `https://app.stack-auth.com/signin`,
  signUpUrl: `https://app.stack-auth.com/signup`,
};
