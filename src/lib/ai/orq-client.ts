import { Orq } from "@orq-ai/node";

// Singleton orq.ai client
let _client: Orq | null = null;

export function getOrqClient(): Orq {
  if (!_client) {
    _client = new Orq({
      apiKey: process.env.ORQ_API_KEY!,
    });
  }
  return _client;
}

/**
 * Invoke an orq.ai deployment by key.
 * Used to call managed LLM deployments with built-in tracing, routing, and versioning.
 */
export async function invokeDeployment(options: {
  key: string;
  inputs: Record<string, string>;
  metadata?: Record<string, string>;
  identity?: {
    id: string;
    displayName?: string;
    email?: string;
    tags?: string[];
  };
  threadId?: string;
  threadTags?: string[];
}) {
  const client = getOrqClient();

  const completion = await client.deployments.invoke({
    key: options.key,
    inputs: options.inputs,
    metadata: options.metadata,
    identity: options.identity
      ? {
          id: options.identity.id,
          displayName: options.identity.displayName,
          email: options.identity.email,
          tags: options.identity.tags,
        }
      : undefined,
    thread: options.threadId
      ? {
          id: options.threadId,
          tags: options.threadTags,
        }
      : undefined,
  });

  if (completion?.choices?.[0]?.message?.type === "content") {
    return {
      content: completion.choices[0].message.content,
      raw: completion,
    };
  }

  return { content: null, raw: completion };
}
