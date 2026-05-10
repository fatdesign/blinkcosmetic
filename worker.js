export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- PUBLIC API ---

    // GET /api/times?date=YYYY-MM-DD
    if (url.pathname === "/api/times" && method === "GET") {
      const date = url.searchParams.get("date");
      if (!date) return new Response("Date required", { status: 400, headers: corsHeaders });

      // Fetch available slots for this date
      const availableSlots = await env.DB.get(`slots:${date}`, { type: "json" }) || [
        "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"
      ];

      // Fetch existing bookings to filter out
      const bookings = await env.DB.get(`bookings:${date}`, { type: "json" }) || [];
      const bookedTimes = bookings.map(b => b.time);

      const filteredSlots = availableSlots.filter(t => !bookedTimes.includes(t));

      return new Response(JSON.stringify(filteredSlots), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // POST /api/bookings
    if (url.pathname === "/api/bookings" && method === "POST") {
      const data = await request.json();
      const { date, time, service, name, email } = data;

      if (!date || !time || !name || !email) {
        return new Response("Missing data", { status: 400, headers: corsHeaders });
      }

      // Check if already booked
      const bookings = await env.DB.get(`bookings:${date}`, { type: "json" }) || [];
      if (bookings.some(b => b.time === time)) {
        return new Response("Slot already booked", { status: 409, headers: corsHeaders });
      }

      // Add new booking
      bookings.push({ ...data, id: Date.now(), createdAt: new Date().toISOString() });
      await env.DB.put(`bookings:${date}`, JSON.stringify(bookings));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- ADMIN API --- (Simplified for this demo, use a secret in production)
    
    // GET /api/admin/all-bookings
    if (url.pathname === "/api/admin/all-bookings" && method === "GET") {
      const list = await env.DB.list({ prefix: "bookings:" });
      const allBookings = [];
      for (const key of list.keys) {
        const dateBookings = await env.DB.get(key.name, { type: "json" });
        allBookings.push(...dateBookings);
      }
      return new Response(JSON.stringify(allBookings), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // POST /api/admin/slots
    if (url.pathname === "/api/admin/slots" && method === "POST") {
      const { date, slots } = await request.json();
      await env.DB.put(`slots:${date}`, JSON.stringify(slots));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
