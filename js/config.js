// Config real de este proyecto. La llave anon de Supabase y la de Google Maps
// están diseñadas para exponerse en el navegador (por eso viven aquí), pero
// AMBAS deben quedar restringidas: la anon key por RLS (pendiente a v2) y la
// de Maps por HTTP referrer en Google Cloud, a los dominios reales donde se
// aloje esta app. Nunca pongas aquí GOOGLE_ROUTES_API_KEY — esa es secreta y
// solo vive en los secrets de la Edge Function.
window.PETGROUND_CONFIG = {
  SUPABASE_URL: "https://rekegzxcypltnlxhsevc.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJla2VnenhjeXBsdG5seGhzZXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjEzNzYsImV4cCI6MjA5MTMzNzM3Nn0.SpgWNFuYd9dW9-5OSWcZruEZdhXcUM8e6-UdJQ0A4gQ",
  GOOGLE_MAPS_BROWSER_KEY: "AIzaSyDoarx-NKfGSaYxkIj_-BcC1FURGLAFa7Y"
};
