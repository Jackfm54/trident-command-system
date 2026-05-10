// Visual detection + contact correlation via Lovable AI Gateway (Gemini 2.5 Pro vision)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, mime_type, contacts = [], sensor = "EO/IR" } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataUrl = `data:${mime_type ?? "image/jpeg"};base64,${image_base64}`;

    const tracksSummary = contacts.slice(0, 30).map((c: any) =>
      `${c.track_id} | dom=${c.domain} | brg=${Math.round(c.bearing ?? 0)}° rng=${(c.range_nm ?? 0).toFixed(1)}nm spd=${Math.round(c.speed_kts ?? 0)}kt hdg=${Math.round(c.heading ?? 0)}° class=${c.classification} type=${c.platform_type ?? "?"}`
    ).join("\n");

    const systemPrompt = `Eres un OPERADOR DE INTELIGENCIA VISUAL NAVAL en un CMS Aegis-class. Analizas imágenes de sensores ${sensor} (EO/IR/SAR) montados en una fragata. 
Tu misión:
1) DETECCIÓN: identifica TODAS las plataformas visibles (buques de guerra, mercantes, pesqueros, aeronaves, helos, UAV/loitering munitions, USV/UUV, misiles, periscopios, estela/wake).
2) CLASIFICACIÓN: para cada detección emite NATO STANAG 1241 (FRIEND/HOSTILE/NEUTRAL/SUSPECT/UNKNOWN) + plataforma específica (clase de buque, modelo de aeronave, tipo de munición).
3) FIRMA & CARACTERÍSTICAS: longitud estimada, propulsión, armamento visible, banderas/marcas, comportamiento.
4) CORRELACIÓN: compara contra los TRACKS activos suministrados y enlaza la detección visual al track_id correcto si hay coincidencia probable (rumbo/velocidad/dominio/tipo).
5) RECOMENDACIÓN TÁCTICA: ROE, sensor cueing, weapon pairing.
Devuelve SIEMPRE JSON estructurado mediante el tool call.`;

    const userText = `SENSOR: ${sensor}
TRACKS ACTIVOS EN CMS:
${tracksSummary || "(ninguno)"}

Analiza la imagen adjunta. Detecta todos los contactos visibles y correlaciona con los tracks listados.`;

    const tools = [{
      type: "function",
      function: {
        name: "report_visual_intel",
        description: "Reporta detecciones visuales y correlación con tracks CMS.",
        parameters: {
          type: "object",
          properties: {
            scene_summary: { type: "string", description: "Descripción táctica de 1-2 frases." },
            sea_state: { type: "string", description: "Estado del mar / visibilidad / iluminación." },
            detections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "Plataforma específica (ej: Type-22 Frigate, Bayraktar TB2, Iranian dhow)." },
                  domain: { type: "string", enum: ["air", "surface", "subsurface", "electronic"] },
                  classification: { type: "string", enum: ["hostile", "friend", "neutral", "suspect", "unknown", "assumed_friend"] },
                  confidence: { type: "number", description: "0..1" },
                  visible_armament: { type: "string" },
                  estimated_length_m: { type: "number" },
                  flag_or_markings: { type: "string" },
                  behavior: { type: "string", description: "Aproximación, transitando, loitering, kamikaze run, evasión..." },
                  bbox_norm: {
                    type: "array",
                    items: { type: "number" },
                    description: "[x,y,w,h] normalizado 0..1 dentro de la imagen",
                  },
                  correlated_track_id: { type: "string", description: "track_id si hay match, o cadena vacía." },
                  correlation_reasoning: { type: "string" },
                  threat_score: { type: "number", description: "0..10" },
                  recommended_action: { type: "string" },
                },
                required: ["label", "domain", "classification", "confidence", "threat_score", "recommended_action"],
                additionalProperties: false,
              },
            },
            overall_threat_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
            recommended_alert_condition: { type: "string", enum: ["white", "yellow", "red"] },
          },
          required: ["scene_summary", "detections", "overall_threat_level", "recommended_alert_condition"],
          additionalProperties: false,
        },
      },
    }];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "report_visual_intel" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos agotados en Lovable AI" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) {
      return new Response(JSON.stringify({ error: "Sin tool_call de la IA", raw: data }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ result: args, model: "google/gemini-2.5-pro" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("visual-detect error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
