const template = await Bun.file(`${import.meta.dir}/../templates/configure.html`).text();

export function handleConfigure(baseURL: string): Response {
  const html = template.replaceAll("{{BASE_URL}}", baseURL);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
