export const name = 'ready';
export const once = true;
export async function execute(client) {
  console.log(`Ready as ${client.user.tag}`);
}
