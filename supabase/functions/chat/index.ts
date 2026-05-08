// supabase/functions/chat/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5-mini";
const MAX_TOOL_ITERATIONS = 8;

const TOOLS = [
  { type: "function", function: { name: "create_task", description: "Create a task. project_id optional (omit=inbox). parent_task_id makes it a subtask. priority 1=urgent..4=low.", parameters: { type: "object", properties: { title: { type: "string" }, project_id: { type: "string" }, parent_task_id: { type: "string" }, description: { type: "string" }, priority: { type: "integer", minimum: 1, maximum: 4 }, due_date: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["title"] } } },
  { type: "function", function: { name: "update_task", description: "Update task fields. Pass only fields to change. status='done' marks complete.", parameters: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, status: { type: "string", enum: ["todo","in_progress","done"] }, priority: { type: "integer", minimum: 1, maximum: 4 }, due_date: { type: "string" }, project_id: { type: "string" }, parent_task_id: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["task_id"] } } },
  { type: "function", function: { name: "list_tasks", description: "List tasks with optional filters. Up to 50.", parameters: { type: "object", properties: { project_id: { type: "string" }, parent_task_id: { type: "string" }, status: { type: "string", enum: ["todo","in_progress","done"] }, due_before: { type: "string" }, due_after: { type: "string" }, inbox_only: { type: "boolean" } } } } },
  { type: "function", function: { name: "find_task", description: "Find tasks by title (fuzzy). Use before adding subtasks.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "create_project", description: "Create a project.", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, color: { type: "string" }, icon: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "list_projects", description: "List all projects.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "create_note", description: "Quick note. For longer/structured content use create_page.", parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["content"] } } },
  { type: "function", function: { name: "create_page", description: "Structured page (Notion-style). Use for project plans. project_id attaches to project.", parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, parent_id: { type: "string" }, project_id: { type: "string" } }, required: ["title","content"] } } },
  { type: "function", function: { name: "search", description: "Search tasks/notes/pages.", parameters: { type: "object", properties: { query: { type: "string" }, kinds: { type: "array", items: { type: "string", enum: ["task","note","page"] } } }, required: ["query"] } } },
  { type: "function", function: { name: "get_today", description: "Today's ISO date.", parameters: { type: "object", properties: {} } } },
];

async function runTool(name: string, args: any, client: SupabaseClient, userId: string, touched: Set<string>) {
  switch (name) {
    case "create_task": {
      const { data, error } = await client.from("tasks").insert({ user_id: userId, title: args.title, project_id: args.project_id ?? null, parent_task_id: args.parent_task_id ?? null, description: args.description ?? null, priority: args.priority ?? 4, due_date: args.due_date ?? null, tags: args.tags ?? [] }).select("id, title, project_id, parent_task_id, due_date, priority, status").single();
      if (error) return { ok: false, error: error.message };
      touched.add("tasks"); return { ok: true, task: data };
    }
    case "update_task": {
      const { task_id, ...rest } = args;
      const patch: any = {};
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
      patch.updated_at = new Date().toISOString();
      if (rest.status === "done") patch.completed_at = new Date().toISOString();
      const { data, error } = await client.from("tasks").update(patch).eq("id", task_id).select("id, title, status, priority, due_date, project_id, parent_task_id").single();
      if (error) return { ok: false, error: error.message };
      touched.add("tasks"); return { ok: true, task: data };
    }
    case "list_tasks": {
      let q = client.from("tasks").select("id, title, status, priority, due_date, project_id, parent_task_id").order("created_at", { ascending: false }).limit(50);
      if (args.project_id) q = q.eq("project_id", args.project_id);
      if (args.parent_task_id) q = q.eq("parent_task_id", args.parent_task_id);
      if (args.status) q = q.eq("status", args.status);
      if (args.due_before) q = q.lte("due_date", args.due_before);
      if (args.due_after) q = q.gte("due_date", args.due_after);
      if (args.inbox_only) q = q.is("project_id", null);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      return { ok: true, tasks: data };
    }
    case "find_task": {
      const { data, error } = await client.from("tasks").select("id, title, project_id, status").ilike("title", `%${args.query}%`).limit(10);
      if (error) return { ok: false, error: error.message };
      return { ok: true, matches: data };
    }
    case "create_project": {
      const { data, error } = await client.from("projects").insert({ user_id: userId, name: args.name, description: args.description ?? null, color: args.color ?? "#3b82f6", icon: args.icon ?? null }).select("id, name, color").single();
      if (error) return { ok: false, error: error.message };
      touched.add("projects"); return { ok: true, project: data };
    }
    case "list_projects": {
      const { data, error } = await client.from("projects").select("id, name, color, description").order("position");
      if (error) return { ok: false, error: error.message };
      return { ok: true, projects: data };
    }
    case "create_note": {
      const { data, error } = await client.from("notes").insert({ user_id: userId, title: args.title ?? "Untitled", content: args.content, tags: args.tags ?? [] }).select("id, title").single();
      if (error) return { ok: false, error: error.message };
      touched.add("notes"); return { ok: true, note: data };
    }
    case "create_page": {
      const { data, error } = await client.from("pages").insert({ user_id: userId, title: args.title, content: args.content, parent_id: args.parent_id ?? null, project_id: args.project_id ?? null }).select("id, title, project_id, parent_id").single();
      if (error) return { ok: false, error: error.message };
      touched.add("pages"); return { ok: true, page: data };
    }
    case "search": {
      const kinds = args.kinds ?? ["task","note","page"];
      const out: any = {};
      if (kinds.includes("task")) {
        const { data } = await client.from("tasks").select("id, title, status, project_id").or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%`).limit(10);
        out.tasks = data ?? [];
      }
      if (kinds.includes("note")) {
        const { data } = await client.from("notes").select("id, title, tags").or(`title.ilike.%${args.query}%,content.ilike.%${args.query}%`).limit(10);
        out.notes = data ?? [];
      }
      if (kinds.includes("page")) {
        const { data } = await client.from("pages").select("id, title, project_id").or(`title.ilike.%${args.query}%,content.ilike.%${args.query}%`).limit(10);
        out.pages = data ?? [];
      }
      return { ok: true, ...out };
    }
    case "get_today": return { ok: true, date: new Date().toISOString().slice(0,10) };
    default: return { ok: false, error: `Unknown tool: ${name}` };
  }
}

function buildSystemPrompt(today: string, projects: any[]): string {
  const list = projects.length ? projects.map(p => `- ${p.name} (id: ${p.id})${p.description ? ` — ${p.description}` : ""}`).join("\n") : "(none yet)";
  return `You are EagleVision, Jair's personal life-organization assistant.

Today is ${today}.

Jair's projects:
${list}

You can create and update tasks, notes, and project plans on his behalf using the provided tools. When he names a project, find its id from the list above and pass it directly — don't call list_projects unless the project clearly isn't there.

Conventions:
- Single-user app. Be direct and concise. Skip greetings and filler. Confirm actions in one sentence.
- Tasks have status (todo/in_progress/done) and priority (1=urgent..4=low). Default priority 4.
- For project plans / longer briefs, use create_page with project_id set. Use create_note for quick captures.
- Subtasks: pass parent_task_id when adding child tasks. Use find_task first if you don't know the parent's id.
- "today"=${today}, "tomorrow"=next day, "next week"=coming Monday. Always pass ISO dates.
- Don't ask "are you sure?" for creates. Do ask before bulk delete or overwriting existing content.
- If a tool errors, tell Jair plainly. Don't loop on the same failing call.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = userData.user.id;

    const body = await req.json();
    const { messages = [], model = DEFAULT_MODEL } = body;

    const { data: projects } = await userClient.from("projects").select("id, name, description").order("position");
    const today = new Date().toISOString().slice(0, 10);
    const history: any[] = [{ role: "system", content: buildSystemPrompt(today, projects ?? []) }, ...messages];

    const touched = new Set<string>();
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const resp = await fetch(GATEWAY_URL, { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: history, tools: TOOLS, tool_choice: "auto", stream: false }) });
      if (!resp.ok) {
        const text = await resp.text();
        const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
        return new Response(JSON.stringify({ error: `Gateway: ${text.slice(0,300)}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await resp.json();
      const choice = data.choices?.[0]?.message;
      if (!choice) return new Response(JSON.stringify({ error: "No choice" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      history.push(choice);
      if (!choice.tool_calls?.length) {
        return new Response(JSON.stringify({ reply: choice.content ?? "", touched: Array.from(touched), usage: data.usage ?? null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      for (const tc of choice.tool_calls) {
        let parsed: any = {};
        try { parsed = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch {}
        const result = await runTool(tc.function.name, parsed, userClient, userId, touched);
        history.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
    return new Response(JSON.stringify({ error: "Tool loop limit" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
