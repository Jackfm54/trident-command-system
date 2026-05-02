import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactInput {
  track_id: string;
  domain: string;
  bearing?: number;
  range_nm?: number;
  speed_kts?: number;
  altitude_ft?: number;
  heading?: number;
  signal_signature?: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { contact } = (await req.json()) as { contact: ContactInput };
    if (!contact?.track_id) {
      return new Response(JSON.stringify({ error: "missing contact" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres el subsistema de fusión de datos e IA de un Sistema de Combate (TCM) embarcado en una fragata de la Armada Nacional de Colombia.
Combinas inferencia tipo LLM (Llama) sobre parámetros cinemáticos/ESM con detección visual tipo YOLO sobre cámaras EO/IR.
Clasifica el contacto en: friend, hostile, neutral, suspect, unknown.
Identifica plataforma probable (ej. fast-jet, anti-ship-missile, helo, frigate, patrol-boat, fishing-vessel, submarine, uav, jammer).
Asigna confianza 0-1 y un razonamiento muy breve táctico (máx 140 chars, en español).
Considera: dominio, velocidad, altitud, perfil cinemático y firma. Misiles antibuque suelen ir <100ft y >500kts. Submarinos <30kts subsuperficie.`;

    const userPrompt = `Contacto entrante:
Track: ${contact.track_id}
Dominio: ${contact.domain}
Marcación: ${contact.bearing ?? "?"}°
Distancia: ${contact.range_nm ?? "?"} nm
Velocidad: ${contact.speed_kts ?? "?"} kts
Altitud: ${contact.altitude_ft ?? "?"} ft
Rumbo: ${contact.heading ?? "?"}°
Firma ESM/EO: ${contact.signal_signature ?? "n/d"}
Notas: ${contact.notes ?? "n/d"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_contact",
              description: "Devuelve clasificación táctica del contacto",
              parameters: {
                type: "object",
                properties: {
                  classification: {
                    type: "string",
                    enum: ["friend", "hostile", "neutral", "suspect", "unknown"],
                  },
                  platform_type: { type: "string" },
                  ai_confidence: { type: "number", minimum: 0, maximum: 1 },
                  ai_reasoning: { type: "string" },
                  recommended_action: { type: "string" },
                },
                required: ["classification", "platform_type", "ai_confidence", "ai_reasoning", "recommended_action"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_contact" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Reintente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await response.text();
      console.error("AI gateway error", response.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({ result: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-contact error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
