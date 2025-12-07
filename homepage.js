let cart = [];
let currentBooking = null;
let stellaBookingState = null; // in-chat booking state for inline chat bookings
let bookingConversationState = null; // tracks multi-step booking conversation (destination, dates, guests)
let bookingHistory = []; // completed bookings
let visitedPlaces = []; // visited destinations
let conversationHistory = [];
let userLocation = null;

// Offers and coupons (client-side demo)
const offers = [
  { code: "WELCOME10", discount: 0.1, description: "10% off for new users" },
  { code: "SUMMER20", discount: 0.2, description: "Summer Sale - 20% off" },
];
let appliedCoupon = null;

// Destinations database
const destinations = [
  {
    name: "Paris, France",
    price: 1299,
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
    region: "Europe",
  },
  {
    name: "Santorini, Greece",
    price: 1599,
    image: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=800",
    region: "Europe",
  },
  {
    name: "Swiss Alps",
    price: 2199,
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    region: "Europe",
  },
  {
    name: "Dubai, UAE",
    price: 1799,
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800",
    region: "Middle East",
  },
  {
    name: "Maldives",
    price: 2499,
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800",
    region: "Asia",
  },
  {
    name: "Tokyo, Japan",
    price: 1899,
    image: "https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?w=800",
    region: "Asia",
  },
];

// Get user location
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
      },
      (error) => {
        console.log("Location access denied");
      }
    );
  }
}

// Initialize
getUserLocation();

// Set minimum date to today
const today = new Date().toISOString().split("T")[0];

// Stella Chatbot Functions
function toggleStella() {
  const stellaWindow = document.getElementById("stellaChatWindow");
  stellaWindow.classList.toggle("active");
  if (stellaWindow.classList.contains("active")) {
    document.getElementById("stellaInput").focus();
  }
}

function handleStellaEnter(event) {
  if (event.key === "Enter") {
    sendStellaMessage();
  }
}

function stellaQuickAction(message) {
  document.getElementById("stellaInput").value = message;
  sendStellaMessage();
}

function addStellaMessage(content, isUser = false) {
  const chatBody = document.getElementById("stellaChatBody");
  const messageDiv = document.createElement("div");
  messageDiv.className = `stella-message ${isUser ? "user" : "bot"}`;

  // message-content will hold the textual/html content. We'll add a separate actions container
  // so we can append interactive buttons (e.g. Book Now) safely.
  messageDiv.innerHTML = `
                    <div class="message-avatar">${isUser ? "👤" : "🤖"}</div>
                    <div class="message-content">${content}</div>
                    <div class="stella-actions"></div>
                `;

  chatBody.appendChild(messageDiv);

  chatBody.scrollTop = chatBody.scrollHeight;
}

function showTypingIndicator() {
  document.getElementById("typingIndicator").classList.add("active");
  const chatBody = document.getElementById("stellaChatBody");
  chatBody.scrollTop = chatBody.scrollHeight;
}

function hideTypingIndicator() {
  document.getElementById("typingIndicator").classList.remove("active");
}

async function sendStellaMessage() {
  const input = document.getElementById("stellaInput");
  const message = input.value.trim();

  if (!message) return;

  // Hide quick actions when user starts chatting
  const quickActionsContainer = document.getElementById(
    "stellaQuickActionsContainer"
  );
  if (quickActionsContainer) {
    quickActionsContainer.style.display = "none";
  }

  // Add user message
  addStellaMessage(message, true);
  input.value = "";

  // Check if we're in a booking conversation - if so, process the input locally
  if (bookingConversationState) {
    if (processBookingConversationInput(message)) {
      return; // Booking conversation handled locally
    }
  }

  // Show typing indicator
  showTypingIndicator();

  // Add to conversation history
  conversationHistory.push({
    role: "user",
    content: message,
  });

  // Process with AI
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are Stella, a friendly AI travel assistant for Wanderlust Travel. Your role is to help users:

1. Find destinations based on their location and preferences
2. Sort and filter trips by price
3. Add bookings to their cart
4. Answer travel questions

Available destinations:
${destinations.map((d) => `- ${d.name}: ${d.price} (${d.region})`).join("\n")}

Current cart: ${cart.length} items

User location: ${
          userLocation
            ? `Lat: ${userLocation.lat}, Lon: ${userLocation.lon}`
            : "Not available"
        }

When users ask about:
- "near me" or location-based queries: Recommend destinations based on their region
- "cheapest" or budget queries: Sort by price (low to high) and recommend affordable options
- "expensive" or "luxury": Recommend premium destinations
- "book" queries: Guide them to book a specific destination

Always be friendly, concise, and helpful. Use emojis occasionally. When suggesting destinations, format as: "✈️ [Name] - $[price]"

If they want to book, you can trigger booking by saying: "I'll open the booking form for [destination name] now!"`,
        messages: conversationHistory,
      }),
    });

    const data = await response.json();
    hideTypingIndicator();

    if (data.content && data.content[0]) {
      const assistantMessage = data.content[0].text;

      conversationHistory.push({
        role: "assistant",
        content: assistantMessage,
      });

      addStellaMessage(assistantMessage);

      // Check if booking should be triggered
      destinations.forEach((dest) => {
        if (
          assistantMessage
            .toLowerCase()
            .includes(`booking form for ${dest.name.toLowerCase()}`)
        ) {
          setTimeout(() => {
            openBookingModal(dest.name, dest.price, dest.image);
          }, 1000);
        }
      });
    }
  } catch (error) {
    hideTypingIndicator();
    handleStellaFallback(message);
  }
}

function handleStellaFallback(message) {
  const msg = message.toLowerCase();
  let response = "";

  // Location-based queries
  if (
    msg.includes("near") ||
    msg.includes("location") ||
    msg.includes("where")
  ) {
    if (userLocation) {
      response = `Based on your location, I recommend these amazing destinations:<br><br>`;
      destinations.slice(0, 3).forEach((d) => {
        response += `✈️ ${d.name} - ${d.price}<br>`;
      });
      response += `<br>Would you like to book any of these?`;
    } else {
      response = `I don't have access to your location yet. Here are our popular destinations:<br><br>`;
      destinations.forEach((d) => {
        response += `✈️ ${d.name} - ${d.price} (${d.region})<br>`;
      });
    }
  }
  // Price sorting - cheapest
  else if (
    msg.includes("cheap") ||
    msg.includes("budget") ||
    msg.includes("affordable") ||
    msg.includes("low price")
  ) {
    const sorted = [...destinations].sort((a, b) => a.price - b.price);
    response = `Here are our most affordable destinations: 💰<br><br>`;
    sorted.forEach((d) => {
      response += `✈️ ${d.name} - ${d.price}<br>`;
    });
    response += `<br>Great value for amazing experiences!`;
  }
  // Price sorting - expensive/luxury
  else if (
    msg.includes("expensive") ||
    msg.includes("luxury") ||
    msg.includes("premium") ||
    msg.includes("high")
  ) {
    const sorted = [...destinations].sort((a, b) => b.price - a.price);
    response = `Here are our luxury destinations: 💎<br><br>`;
    sorted.forEach((d) => {
      response += `✈️ ${d.name} - ${d.price}<br>`;
    });
    response += `<br>Experience the finest travel has to offer!`;
  }
  // Booking queries
  else if (msg.includes("book")) {
    let foundDestination = null;

    // Check if specific destination mentioned
    for (let dest of destinations) {
      if (
        msg.includes(dest.name.toLowerCase()) ||
        msg.includes(dest.name.split(",")[0].toLowerCase())
      ) {
        foundDestination = dest;
        break;
      }
    }

    if (foundDestination) {
      // Start conversational booking flow with user input for dates
      response = `Great choice! Starting booking for ${foundDestination.name}...`;
      addStellaMessage(response);
      setTimeout(() => {
        startConversationalBooking(
          foundDestination.name,
          foundDestination.price,
          foundDestination.image
        );
      }, 600);
      return;
    } else if (msg.includes("book a trip") || msg === "book a trip") {
      // If user just clicked "Book a trip" quick action, offer choices
      response = `I can help you book a trip! Here are our destinations:<br><br>`;
      destinations.forEach((d) => {
        response += `✈️ ${d.name} - $${d.price}<br>`;
      });
      response += `<br><strong>Just tell me which one:</strong> "Book Paris", "Book Maldives", etc. and we'll get your dates! ⚡`;
    } else {
      response = `I can help you book a trip! Here are our destinations:<br><br>`;
      destinations.forEach((d) => {
        response += `✈️ ${d.name} - ${d.price}<br>`;
      });
      response += `<br>Just say "Book [destination name]" (e.g., "Book Paris") and we'll handle your dates! ⚡`;
    }
  }
  // Cart queries
  else if (msg.includes("cart") || msg.includes("booking")) {
    if (cart.length === 0) {
      response = `Your cart is empty. Let me show you our amazing destinations!<br><br>`;
      destinations.forEach((d) => {
        response += `✈️ ${d.name} - ${d.price}<br>`;
      });
    } else {
      response = `You have ${cart.length} trip(s) in your cart! 🎉<br><br>`;
      cart.forEach((item) => {
        response += `📍 ${item.destination} - ${item.guests} guest(s)<br>`;
      });
      response += `<br>Ready to checkout?`;
    }
  }
  // Price list
  else if (
    msg.includes("price") ||
    msg.includes("cost") ||
    msg.includes("how much")
  ) {
    response = `Here's our complete price list: 💵<br><br>`;
    destinations.forEach((d) => {
      response += `${d.name}: ${d.price}<br>`;
    });
    response += `<br>All prices are per person and include accommodation!`;
  }
  // General help
  else {
    response = `I'm Stella, your AI travel assistant! I can help you:<br><br>
                    📍 Find destinations near you<br>
                    💰 Sort trips by price<br>
                    ✈️ Book your dream vacation<br>
                    📋 Manage your bookings<br><br>
                    Try asking me: "Show me cheap destinations" or "Book Paris"!`;
  }

  addStellaMessage(response);
}

function openBookingModal(destination, price, image) {
  currentBooking = { destination, price, image };

  const preview = document.getElementById("destinationPreview");
  preview.innerHTML = `
                    <img src="${image}" alt="${destination}">
                    <h3>${destination}</h3>
                    <p class="price-tag">${price.toLocaleString()} per individual</p>
                `;

  const checkInInput = document.getElementById("checkIn");
  const checkOutInput = document.getElementById("checkOut");
  checkInInput.min = today;
  checkOutInput.min = today;
  checkInInput.value = "";
  checkOutInput.value = "";

  document.getElementById("bookingModal").classList.add("active");
}

// Destination details data (popular sites, attractions, likes)
const destinationDetails = {
  "Paris, France": {
    short: "Romantic streets, world-class museums and iconic landmarks.",
    sites: [
      "Eiffel Tower",
      "Louvre Museum",
      "Notre-Dame Cathedral",
      "Montmartre",
    ],
    attractions: [
      {
        title: "Eiffel Tower View",
        img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600",
      },
      {
        title: "Louvre Courtyard",
        img: "https://images.unsplash.com/photo-1504208434309-cb69f4fe52b0?w=600",
      },
    ],
    likes: "Liked by 1.2K ❤️",
  },
  "Santorini, Greece": {
    short: "Cliffside villages with dazzling sunsets over the Aegean sea.",
    sites: ["Oia Village", "Fira Town", "Ancient Thera", "Red Beach"],
    attractions: [
      {
        title: "Caldera Sunset",
        img: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=600",
      },
      {
        title: "Whitewashed Streets",
        img: "https://thumbs.dreamstime.com/b/oia-village-santorini-greece-whitewashed-buildings-cascade-down-cliffs-overlooking-turquoise-sea-ideal-travel-vacation-383621761.jpg",
      },
    ],
    likes: "Liked by 1.4K ❤️",
  },
  "Swiss Alps": {
    short: "Snow-capped peaks, alpine lakes and outdoor adventures.",
    sites: ["Jungfraujoch", "Zermatt", "Interlaken", "Lucerne Lake"],
    attractions: [
      {
        title: "Mountain Peaks",
        img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600",
      },
      {
        title: "Alpine Trails",
        img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600",
      },
    ],
    likes: "Liked by 2.1K ❤️",
  },
  "Dubai, UAE": {
    short: "Modern skyline, desert dunes and luxury experiences.",
    sites: ["Burj Khalifa", "Palm Jumeirah", "Dubai Marina", "Desert Safari"],
    attractions: [
      {
        title: "Marina Skyline",
        img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600",
      },
      {
        title: "Desert Dunes",
        img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600",
      },
    ],
    likes: "Liked by 1.6K ❤️",
  },
  Maldives: {
    short: "Turquoise waters, overwater villas and serene island life.",
    sites: ["Male", "North Atolls", "Reef Diving Spots", "Resort Islands"],
    attractions: [
      {
        title: "Overwater Bungalow",
        img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600",
      },
      {
        title: "Coral Reefs",
        img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600",
      },
    ],
    likes: "Liked by 3.3K ❤️",
  },
  "Tokyo, Japan": {
    short: "A vibrant blend of modern cityscapes and timeless tradition.",
    sites: [
      "Shibuya Crossing",
      "Senso-ji Temple",
      "Meiji Shrine",
      "Tokyo Tower",
    ],
    attractions: [
      {
        title: "Temple Gardens",
        img: "https://jordanandemily.com.au/wp-content/uploads/2025/04/Senso-Ji-Temple-Tokyo-Japan-1.webp",
      },
      {
        title: "City Lights",
        img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600",
      },
    ],
    likes: "Liked by 1.8K ❤️",
  },
};

function showDestinationDetails(name, image) {
  const details = destinationDetails[name] || {};
  document.getElementById("destTitle").textContent = name;
  const imgEl = document.getElementById("destBannerImg");
  imgEl.src =
    image ||
    (details.attractions &&
      details.attractions[0] &&
      details.attractions[0].img) ||
    "";
  document.getElementById("destShort").textContent = details.short || "";

  const sitesEl = document.getElementById("destSites");
  sitesEl.innerHTML = "";
  (details.sites || []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    sitesEl.appendChild(li);
  });

  const attrEl = document.getElementById("destAttractions");
  attrEl.innerHTML = "";
  (details.attractions || []).forEach((a) => {
    const card = document.createElement("div");
    card.className = "attraction-card";
    card.innerHTML = `<img src="${a.img}" alt="${a.title}"><div style="font-weight:600; font-size:0.95rem; color:#333;">${a.title}</div>`;
    attrEl.appendChild(card);
  });

  document.getElementById("destLikes").textContent = details.likes || "";

  document.getElementById("destinationDetailsModal").classList.add("active");
}

function closeDestinationDetails() {
  document.getElementById("destinationDetailsModal").classList.remove("active");
}

// Premium Lounge modal functions
function showPremiumLoungeModal(event) {
  if (event) event.preventDefault();
  document.getElementById("premiumLoungeModal").classList.add("active");
}

function closePremiumLoungeModal() {
  document.getElementById("premiumLoungeModal").classList.remove("active");
}

function addPremiumLoungeToCart() {
  const premiumItem = {
    destination: "Premium Lounge Access",
    price: 399,
    isPremiumLounge: true,
    image:
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23FFD700" width="100" height="100"/><text x="50" y="60" font-size="40" text-anchor="middle" fill="white">💼</text></svg>',
    id: Date.now(),
    checkIn: new Date().toISOString().split("T")[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    guests: "1",
  };

  cart.push(premiumItem);
  updateCart();
  saveCartToStorage();
  closePremiumLoungeModal();
  alert("✨ Premium Lounge Access added to your cart!");
}

// Explore section toggle & interactions
function toggleExplore() {
  const sec = document.getElementById("exploreSection");
  if (!sec) return;
  sec.style.display =
    sec.style.display === "none" || !sec.style.display ? "block" : "none";
  if (sec.style.display === "block") {
    populateExploreList();
  }
}

function populateExploreList() {
  const list = document.getElementById("exploreList");
  list.innerHTML = "";
  const entries = [
    { name: "Paris, France" },
    { name: "Santorini, Greece" },
    { name: "Swiss Alps" },
    { name: "Dubai, UAE" },
    { name: "Maldives" },
    { name: "Tokyo, Japan" },
  ];
  entries.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e.name;
    li.addEventListener("click", () => showDestinationDetails(e.name));
    list.appendChild(li);
  });

  // Hook markers
  const markers = document.querySelectorAll(".world-map .marker");
  markers.forEach((m) => {
    m.removeEventListener("click", markerClickHandler);
    m.addEventListener("click", markerClickHandler);
  });
}

function markerClickHandler(e) {
  const dest = this.getAttribute("data-dest");
  if (dest) showDestinationDetails(dest);
}

// Persist cart to localStorage so bookings survive reloads
function saveCartToStorage() {
  try {
    localStorage.setItem("wanderlust_cart", JSON.stringify(cart));
  } catch (e) {
    console.warn("Could not save cart to localStorage", e);
  }
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem("wanderlust_cart");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cart = parsed;
        updateCart();
      }
    }
  } catch (e) {
    console.warn("Could not load cart from localStorage", e);
  }
}

// Start an inline booking flow inside the chat (no popups)
function startStellaBooking(destination, price, image) {
  // create a unique id for this inline booking
  const bid = Date.now();
  stellaBookingState = { id: bid, destination, price, image };

  const formHtml = `
                    <div class="inline-booking" data-bid="${bid}">
                        <div class="destination-inline">
                            <strong>${destination}</strong> — <span class="price-inline">$${price}</span>
                        </div>
                        <div class="inline-fields">
                            <label>Check-in: <input type="date" id="inline-checkin-${bid}" min="${today}"></label>
                            <label>Check-out: <input type="date" id="inline-checkout-${bid}" min="${today}"></label>
                            <label>Guests: <select id="inline-guests-${bid}">
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6+</option>
                            </select></label>
                        </div>
                        <div class="inline-actions">
                            <button class="confirm-inline-booking" data-bid="${bid}">Confirm Booking</button>
                            <button class="cancel-inline-booking" data-bid="${bid}">Cancel</button>
                        </div>
                    </div>
                `;

  // Add a bot message that contains the inline form
  addStellaMessage(
    `Great choice! Please provide your dates and guests below to add <strong>${destination}</strong> to your bookings:` +
      formHtml
  );

  // Attach handlers after the message is rendered
  setTimeout(() => {
    const confirmBtn = document.querySelector(
      `.confirm-inline-booking[data-bid="${bid}"]`
    );
    const cancelBtn = document.querySelector(
      `.cancel-inline-booking[data-bid="${bid}"]`
    );
    if (confirmBtn)
      confirmBtn.addEventListener("click", () => confirmInlineBooking(bid));
    if (cancelBtn)
      cancelBtn.addEventListener("click", () => cancelInlineBooking(bid));
  }, 80);
}

function cancelInlineBooking(bid) {
  // remove the inline booking UI and notify user
  const node = document.querySelector(`.inline-booking[data-bid="${bid}"]`);
  if (node) {
    node.remove();
  }
  addStellaMessage(
    "No problem — booking cancelled. Let me know if you want to try another destination!"
  );
  stellaBookingState = null;
}

// Start a conversational booking flow that asks for dates and guests
function startConversationalBooking(destination, price, image) {
  // Initialize booking state
  bookingConversationState = {
    destination,
    price,
    image,
    step: "checkin", // steps: checkin -> checkout -> guests -> confirm
    checkIn: null,
    checkOut: null,
    guests: "2",
  };

  // Ask for check-in date
  addStellaMessage(
    `Great! Let's book <strong>${destination}</strong> for you! 🎉<br><br>📅 What's your <strong>check-in date</strong>? (Please type in format: YYYY-MM-DD, e.g., 2025-11-15)`
  );
}

// Process user input during booking conversation
function processBookingConversationInput(userInput) {
  if (!bookingConversationState) return false;

  const input = userInput.trim();

  // Step 1: Get check-in date
  if (bookingConversationState.step === "checkin") {
    // Validate date format
    if (!isValidDateFormat(input)) {
      addStellaMessage(
        "Please enter a valid date in format YYYY-MM-DD (e.g., 2025-11-15)"
      );
      return true;
    }

    const checkInDate = new Date(input);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      addStellaMessage(
        "Check-in date must be in the future. Please choose another date."
      );
      return true;
    }

    bookingConversationState.checkIn = input;
    bookingConversationState.step = "checkout";
    addStellaMessage(
      `Perfect! Check-in on ${formatDate(
        input
      )}. 📅<br><br>Now, what's your <strong>check-out date</strong>? (Format: YYYY-MM-DD)`
    );
    return true;
  }

  // Step 2: Get check-out date
  if (bookingConversationState.step === "checkout") {
    if (!isValidDateFormat(input)) {
      addStellaMessage(
        "Please enter a valid date in format YYYY-MM-DD (e.g., 2025-11-18)"
      );
      return true;
    }

    const checkOutDate = new Date(input);
    const checkInDate = new Date(bookingConversationState.checkIn);

    if (checkOutDate <= checkInDate) {
      addStellaMessage(
        "Check-out date must be after check-in date. Please try again."
      );
      return true;
    }

    bookingConversationState.checkOut = input;
    bookingConversationState.step = "guests";
    addStellaMessage(
      `Great! Check-out on ${formatDate(
        input
      )}. 📅<br><br>How many <strong>guests</strong>? (Enter a number, e.g., 2)`
    );
    return true;
  }

  // Step 3: Get guest count
  if (bookingConversationState.step === "guests") {
    const guestCount = parseInt(input);
    if (isNaN(guestCount) || guestCount < 1 || guestCount > 10) {
      addStellaMessage("Please enter a valid number of guests (1-10).");
      return true;
    }

    bookingConversationState.guests = String(guestCount);
    bookingConversationState.step = "confirm";

    // Confirm booking details
    const nights = Math.ceil(
      (new Date(bookingConversationState.checkOut) -
        new Date(bookingConversationState.checkIn)) /
        (1000 * 60 * 60 * 24)
    );
    const totalPrice = bookingConversationState.price * guestCount * nights;

    addStellaMessage(`Let me confirm your booking:<br><br>
                        ✈️ <strong>${
                          bookingConversationState.destination
                        }</strong><br>
                        📅 <strong>Check-in:</strong> ${formatDate(
                          bookingConversationState.checkIn
                        )}<br>
                        📅 <strong>Check-out:</strong> ${formatDate(
                          bookingConversationState.checkOut
                        )}<br>
                        👥 <strong>Guests:</strong> ${guestCount}<br>
                        🌙 <strong>Nights:</strong> ${nights}<br>
                        💰 <strong>Total:</strong> $${totalPrice.toLocaleString()}<br><br>
                        Type "confirm" to proceed or "cancel" to start over.`);
    return true;
  }

  // Step 4: Confirmation
  if (bookingConversationState.step === "confirm") {
    if (input.toLowerCase() === "confirm") {
      completeBooking();
      return true;
    } else if (input.toLowerCase() === "cancel") {
      addStellaMessage(
        "Booking cancelled. Let me know if you'd like to try again!"
      );
      bookingConversationState = null;
      return true;
    } else {
      addStellaMessage(
        'Please type "confirm" to complete the booking or "cancel" to start over.'
      );
      return true;
    }
  }

  return false;
}

// Helper: validate date format YYYY-MM-DD
function isValidDateFormat(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// Complete the booking
function completeBooking() {
  if (!bookingConversationState) return;

  const booking = {
    destination: bookingConversationState.destination,
    price: bookingConversationState.price,
    image: bookingConversationState.image,
    checkIn: bookingConversationState.checkIn,
    checkOut: bookingConversationState.checkOut,
    guests: bookingConversationState.guests,
    id: Date.now(),
  };

  cart.push(booking);
  updateCart();
  saveCartToStorage();

  // Track visited place
  addVisitedPlace(booking.destination, booking.image);

  const nights = Math.ceil(
    (new Date(booking.checkOut) - new Date(booking.checkIn)) /
      (1000 * 60 * 60 * 24)
  );
  const totalPrice = booking.price * parseInt(booking.guests) * nights;

  addStellaMessage(`✅ Booking confirmed! I've added this to your cart.<br><br>
                    🎉 <strong>${booking.destination}</strong><br>
                    📅 ${formatDate(booking.checkIn)} → ${formatDate(
    booking.checkOut
  )} (${nights} night${nights > 1 ? "s" : ""})<br>
                    👥 ${booking.guests} guest${
    booking.guests > 1 ? "s" : ""
  }<br>
                    💰 Total: $${totalPrice.toLocaleString()}<br><br>
                    Ready to checkout anytime from your cart! 🚀`);

  bookingConversationState = null;
}

// Add to visited places
function addVisitedPlace(destination, image) {
  const visited = visitedPlaces.find((v) => v.destination === destination);
  if (!visited) {
    visitedPlaces.push({
      destination,
      image,
      visitedOn: new Date().toISOString().split("T")[0],
    });
    saveVisitedPlaces();
    updateHistoryCount();
  }
}

// Add booking to history
function addToBookingHistory(booking) {
  const historyEntry = {
    ...booking,
    completedOn: new Date().toISOString(),
    status: "completed",
  };
  bookingHistory.push(historyEntry);
  saveBookingHistory();
  updateHistoryCount();
}

// Save booking history to localStorage
function saveBookingHistory() {
  try {
    localStorage.setItem("booking_history", JSON.stringify(bookingHistory));
  } catch (e) {
    console.warn("Could not save booking history", e);
  }
}

// Load booking history from localStorage
function loadBookingHistory() {
  try {
    const raw = localStorage.getItem("booking_history");
    if (raw) {
      bookingHistory = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not load booking history", e);
  }
  updateHistoryCount();
}

// Save visited places to localStorage
function saveVisitedPlaces() {
  try {
    localStorage.setItem("visited_places", JSON.stringify(visitedPlaces));
  } catch (e) {
    console.warn("Could not save visited places", e);
  }
}

// Load visited places from localStorage
function loadVisitedPlaces() {
  try {
    const raw = localStorage.getItem("visited_places");
    if (raw) {
      visitedPlaces = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not load visited places", e);
  }
  updateHistoryCount();
}

// Update history count in nav
function updateHistoryCount() {
  const total = bookingHistory.length + visitedPlaces.length;
  document.getElementById("historyCount").textContent = total;
}

// Toggle booking history modal
function toggleBookingHistory() {
  const modal = document.getElementById("historyModal");
  modal.classList.toggle("active");
  if (modal.classList.contains("active")) {
    displayCompletedBookings();
  }
}

// Switch history tab
function switchHistoryTab(tab) {
  const completedContent = document.getElementById("completedHistory");
  const visitedContent = document.getElementById("visitedHistory");
  const tabs = document.querySelectorAll(".history-tab");

  tabs.forEach((t) => t.classList.remove("active"));
  event.target.classList.add("active");

  if (tab === "completed") {
    completedContent.classList.add("active");
    visitedContent.classList.remove("active");
    displayCompletedBookings();
  } else {
    completedContent.classList.remove("active");
    visitedContent.classList.add("active");
    displayVisitedPlaces();
  }
}

// Display completed bookings
function displayCompletedBookings() {
  const container = document.getElementById("completedItems");

  if (bookingHistory.length === 0) {
    container.innerHTML =
      '<div class="empty-history"><p>No completed bookings yet.</p><p>📅</p><p>Your bookings will appear here once you complete a trip!</p></div>';
    return;
  }

  container.innerHTML = bookingHistory
    .map((booking, index) => {
      const nights = Math.ceil(
        (new Date(booking.checkOut) - new Date(booking.checkIn)) /
          (1000 * 60 * 60 * 24)
      );
      const totalPrice = booking.price * parseInt(booking.guests) * nights;
      const completedDate = new Date(booking.completedOn).toLocaleDateString();

      return `
                    <div class="history-item">
                        <div class="history-item-header" onclick="openTicketDetails(${index})">
                            <img src="${booking.image}" alt="${
        booking.destination
      }" class="history-item-img">
                            <div class="history-item-info">
                                <h4>${booking.destination}</h4>
                                <p class="history-item-date">📅 ${formatDate(
                                  booking.checkIn
                                )} → ${formatDate(booking.checkOut)}</p>
                                <p class="history-item-meta">👥 ${
                                  booking.guests
                                } guest${
        booking.guests > 1 ? "s" : ""
      } | 🌙 ${nights} night${nights > 1 ? "s" : ""}</p>
                            </div>
                        </div>
                        <button class="delete-history-btn" onclick="event.stopPropagation(); deleteCompletedTrip(${index})" title="Delete this trip">🗑️</button>
                    </div>
                `;
    })
    .join("");
}

// Display visited places
function displayVisitedPlaces() {
  const container = document.getElementById("visitedItems");

  if (visitedPlaces.length === 0) {
    container.innerHTML =
      '<div class="empty-history"><p>No visited places yet.</p><p>🌍</p><p>Places you book will be tracked here!</p></div>';
    return;
  }

  container.innerHTML = visitedPlaces
    .map((place, index) => {
      return `
            <div class="visited-place" style="position: relative;">
                <img src="${place.image}" alt="${place.destination}" class="visited-img">
                <div class="visited-info">
                    <h4>${place.destination}</h4>
                    <p>Added: ${place.visitedOn}</p>
                </div>
                <button class="delete-wishlist-btn" onclick="deleteWishlistItem(${index})" title="Remove from wishlist">🗑️</button>
            </div>
        `;
    })
    .join("");
}

// Auto-book with fixed dates (kept for backward compatibility, but not used by default)
function autoBookDestination(destination, price, image) {
  // Generate default dates: check-in tomorrow, check-out in 3 days
  const checkInDate = new Date();
  checkInDate.setDate(checkInDate.getDate() + 1);
  const checkIn = checkInDate.toISOString().split("T")[0];

  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + 2); // 3 days total (1 night + 1 = 2 days difference)
  const checkOut = checkOutDate.toISOString().split("T")[0];

  const guests = "2"; // default 2 guests

  // Create booking immediately
  const booking = {
    destination,
    price,
    image,
    checkIn,
    checkOut,
    guests,
    id: Date.now(),
  };

  cart.push(booking);
  updateCart();
  saveCartToStorage();

  // Notify user in chat with booking details
  addStellaMessage(`🎉 Perfect! I've automatically booked <strong>${destination}</strong> for you!<br><br>
                    📅 <strong>Check-in:</strong> ${formatDate(checkIn)}<br>
                    📅 <strong>Check-out:</strong> ${formatDate(checkOut)}<br>
                    👥 <strong>Guests:</strong> ${guests}<br>
                    💰 <strong>Price:</strong> $${price} per guest, per day<br><br>
                    The booking has been added to your cart. Ready to checkout anytime! 🚀`);
}

function confirmInlineBooking(bid) {
  const checkInEl = document.getElementById(`inline-checkin-${bid}`);
  const checkOutEl = document.getElementById(`inline-checkout-${bid}`);
  const guestsEl = document.getElementById(`inline-guests-${bid}`);

  if (!checkInEl || !checkOutEl || !guestsEl) {
    addStellaMessage("Could not read booking inputs. Please try again.");
    return;
  }

  const checkIn = checkInEl.value;
  const checkOut = checkOutEl.value;
  const guests = guestsEl.value;

  if (!checkIn || !checkOut) {
    addStellaMessage("Please select both check-in and check-out dates.");
    return;
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    addStellaMessage(
      "Check-out date must be after check-in date. Please correct the dates."
    );
    return;
  }

  // Compose booking from stellaBookingState
  if (!stellaBookingState || stellaBookingState.id !== bid) {
    addStellaMessage("Booking state expired. Please try again.");
    return;
  }

  const booking = {
    destination: stellaBookingState.destination,
    price: stellaBookingState.price,
    image: stellaBookingState.image,
    checkIn,
    checkOut,
    guests,
    id: Date.now(),
  };

  cart.push(booking);
  updateCart();
  saveCartToStorage();

  // Replace inline form with a confirmation snippet inside chat
  const inlineNode = document.querySelector(
    `.inline-booking[data-bid="${bid}"]`
  );
  if (inlineNode) {
    inlineNode.innerHTML = `<div class="inline-confirm">✅ Added <strong>${
      booking.destination
    }</strong> (${booking.guests} guest(s)) — ${formatDate(
      booking.checkIn
    )} to ${formatDate(booking.checkOut)}</div>`;
  }

  addStellaMessage(
    `Done — I've added <strong>${booking.destination}</strong> for ${
      booking.guests
    } guest(s) (${formatDate(booking.checkIn)} → ${formatDate(
      booking.checkOut
    )}) to your cart. You can checkout anytime from the cart.`
  );

  stellaBookingState = null;
}

function closeBookingModal() {
  document.getElementById("bookingModal").classList.remove("active");
  document.getElementById("bookingForm").reset();
}

function addPremiumLoungeToCart() {
  // Check if premium lounge already exists in cart
  const premiumExists = cart.find((item) => item.isPremiumLounge === true);

  if (premiumExists) {
    alert("Premium Lounge Access is already in your cart!");
    return;
  }

  const premiumItem = {
    destination: "Premium Lounge Access",
    price: 399,
    isPremiumLounge: true,
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800",
    id: Date.now(),
    checkIn: new Date().toISOString().split("T")[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    guests: "1",
  };

  cart.push(premiumItem);
  updateCart();
  saveCartToStorage();
  closePremiumLoungeModal();
  alert("✨ Premium Lounge Access added to your cart!");
}

function closePaymentModal() {
  document.getElementById("paymentModal").classList.remove("active");
}

document.getElementById("checkIn").addEventListener("change", function () {
  const checkOutInput = document.getElementById("checkOut");
  const checkInDate = new Date(this.value);
  checkInDate.setDate(checkInDate.getDate() + 1);
  checkOutInput.min = checkInDate.toISOString().split("T")[0];
  if (
    checkOutInput.value &&
    new Date(checkOutInput.value) <= new Date(this.value)
  ) {
    checkOutInput.value = "";
  }
});

document.getElementById("bookingForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const checkIn = document.getElementById("checkIn").value;
  const checkOut = document.getElementById("checkOut").value;
  const guests = document.getElementById("guests").value;
  const lgSelected = document.querySelector(
    ".local-guide-options .lg-option.active"
  );
  const localGuideOpt = lgSelected
    ? lgSelected.dataset.value === "true"
    : false;

  if (new Date(checkOut) <= new Date(checkIn)) {
    alert("Check-out date must be after check-in date!");
    return;
  }

  // Local guide fee (fixed per booking)
  const LOCAL_GUIDE_FEE = 75;
  let localGuideFee = 0;
  let localGuideNumber = "";
  if (localGuideOpt) {
    localGuideFee = LOCAL_GUIDE_FEE;
    // prefer the displayed mock number if generated by checkbox handler,
    // otherwise generate a new one
    const displayed = document.getElementById("localGuideNumber");
    if (displayed && displayed.textContent && displayed.textContent.trim()) {
      localGuideNumber = displayed.textContent.trim();
    } else {
      localGuideNumber = generateLocalGuideNumber();
    }
  }

  const booking = {
    ...currentBooking,
    checkIn,
    checkOut,
    guests,
    localGuide: !!localGuideOpt,
    localGuideFee,
    localGuideNumber,
    id: Date.now(),
  };

  cart.push(booking);
  updateCart();
  // persist updated cart
  saveCartToStorage();
  closeBookingModal();
  alert("Trip added to cart successfully!");

  // Notify Stella
  addStellaMessage(
    `Great! I've added ${booking.destination} to your cart! 🎉 You now have ${cart.length} trip(s) booked.`
  );
});

function toggleCart() {
  const modal = document.getElementById("cartModal");
  const overlay = document.getElementById("cartOverlay");
  modal.classList.toggle("active");
  overlay.classList.toggle("active");
}

function removeFromCart(index) {
  cart.splice(index, 1);
  updateCart();
  saveCartToStorage();
}

function calculateDays(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return days;
}

function updateCart() {
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartSummary = document.getElementById("cartSummary");

  cartCount.textContent = cart.length;

  if (cart.length === 0) {
    cartItems.innerHTML =
      '<div class="empty-cart"><p>Your cart looks too light...</p><p>🌍</p><p>Start booking your dream vacation!</p></div>';
    cartSummary.style.display = "none";
    return;
  }

  let subtotal = 0;

  cartItems.innerHTML = cart
    .map((item, index) => {
      // Handle Premium Lounge differently (no days calculation)
      if (item.isPremiumLounge) {
        subtotal += item.price; // Add premium price to subtotal
        return `
                <div class="cart-item" style="border-left: 4px solid #FFD700;">
                    <div class="cart-item-header">
                        <div style="width:80px; height:80px; background:linear-gradient(135deg, #FFD700, #FFA500); display:flex; align-items:center; justify-content:center; font-size:2.5rem; border-radius:8px;">👑</div>
                        <div class="cart-item-info">
                            <h4 style="color: #FFD700;">💼 ${
                              item.destination
                            }</h4>
                            <p class="cart-item-price" style="color: #FFA500;">$${item.price.toLocaleString()}</p>
                            <p style="font-size:0.9rem; color:#666;">VIP Airport Lounge Access</p>
                        </div>
                    </div>
                    <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
                </div>
            `;
      }

      // Regular destination bookings
      const days = calculateDays(item.checkIn, item.checkOut);
      const baseAmount = item.price * parseInt(item.guests) * days;
      const guideFee = item.localGuideFee ? Number(item.localGuideFee) : 0;
      const itemTotal = baseAmount + guideFee;
      subtotal += itemTotal;

      return `
            <div class="cart-item">
                <div class="cart-item-header">
                    <img src="${item.image}" alt="${
        item.destination
      }" class="cart-item-img">
                    <div class="cart-item-info">
                        <h4>${item.destination}</h4>
                        <p class="cart-item-price">$${itemTotal.toLocaleString()}</p>
                    </div>
                </div>
                <div class="cart-item-dates">
                    📅 ${formatDate(item.checkIn)} → ${formatDate(
        item.checkOut
      )} (${days} ${days === 1 ? "night" : "nights"})
                </div>
                <div class="cart-item-guests">
                    👥 ${item.guests} ${
        item.guests === "1" ? "Guest" : "Guests"
      } × $${item.price.toLocaleString()} × ${days} ${
        days === 1 ? "night" : "nights"
      }
                </div>
                ${
                  guideFee > 0
                    ? `<div style="margin-top:6px; font-size:0.9rem; color:#444;">🧭 Local guide: $${guideFee.toLocaleString()}</div>`
                    : ""
                }
                <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
            </div>
        `;
    })
    .join("");

  const platformFee = subtotal * 0.01;
  const taxes = subtotal * 0.08;
  const total = subtotal + platformFee + taxes;

  document.getElementById(
    "subtotal"
  ).textContent = `${subtotal.toLocaleString()}`;
  document.getElementById(
    "platformFee"
  ).textContent = `${platformFee.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  document.getElementById("taxes").textContent = `${taxes.toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`;
  document.getElementById("totalAmount").textContent = `${total.toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`;

  cartSummary.style.display = "block";
  // persist cart after every update
  saveCartToStorage();
}

function formatDate(dateString) {
  const options = { month: "short", day: "numeric", year: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

// Generate a mock local guide contact number (demo only)
function generateLocalGuideNumber() {
  const base = Date.now().toString();
  const suffix = base.slice(-4);
  return `+1-800-555-${suffix}`;
}

function proceedToPayment() {
  if (cart.length === 0) return;

  let subtotal = 0;
  cart.forEach((item) => {
    const days = calculateDays(item.checkIn, item.checkOut);
    const base = item.price * parseInt(item.guests) * days;
    const guideFee = item.localGuideFee ? Number(item.localGuideFee) : 0;
    subtotal += base + guideFee;
  });

  const platformFee = subtotal * 0.01;
  const taxes = subtotal * 0.08;
  const total = subtotal + platformFee + taxes;

  // Apply coupon if present
  let discountAmount = 0;
  if (appliedCoupon) {
    discountAmount = subtotal * appliedCoupon.discount;
  }

  const totalAfterDiscount = subtotal - discountAmount;
  const platformFeeAfter = totalAfterDiscount * 0.01;
  const taxesAfter = totalAfterDiscount * 0.08;
  const finalTotal = totalAfterDiscount + platformFeeAfter + taxesAfter;

  const summary = `
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>${subtotal.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span>Discount:</span>
                        <span>-${discountAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</span>
                    </div>
                    <div class="summary-row">
                        <span>Platform Fee (1%):</span>
                        <span>${platformFeeAfter.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</span>
                    </div>
                    <div class="summary-row">
                        <span>Taxes & Charges (8%):</span>
                        <span>${taxesAfter.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total Amount:</span>
                        <span>${finalTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</span>
                    </div>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; color: black;">
                        <strong>Booking Details:</strong>
                        ${cart
                          .map(
                            (item) => `
                                <div style="margin: 0.5rem 0; font-size: 0.9rem; color:black;">
                                    • ${item.destination} - ${
                              item.guests
                            } guest(s) (${formatDate(
                              item.checkIn
                            )} to ${formatDate(item.checkOut)}) ${
                              item.localGuide
                                ? `<br/><small style="color:#555;">Local guide: $${Number(
                                    item.localGuideFee
                                  ).toLocaleString()}</small>`
                                : ""
                            }
                                </div>
                        `
                          )
                          .join("")}
                    </div>
                    <div style="margin-top:1rem;">
                        <label for="couponInput" style="color:black;">Have a coupon? Apply here:</label>
                        <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                            <input id="couponInput" type="text" placeholder="Enter coupon code" style="flex:1; padding:0.5rem; border:1px solid #ddd; border-radius:6px;">
                            <button onclick="applyCoupon()" style="padding:0.5rem 0.8rem; background:#667eea; color:white; border:none; border-radius:6px;">Apply</button>
                        </div>
                        <div id="couponStatus" style="margin-top:0.5rem; color:#0e9670; font-size:0.9rem;"></div>
                    </div>
                    <div style="margin-top:1rem;">
                        <label for="paymentMethod" style="color:black;">Payment Method:</label>
                        <select id="paymentMethod" style="width:100%; padding:0.5rem; margin-top:0.5rem; border-radius:6px; border:1px solid #ddd;">
                            <option value="paypal">PayPal</option>
                            <option value="upi">UPI / QR</option>
                        </select>
                    </div>
                    <div id="upiSection" style="display:none; margin-top:1rem; text-align:center;">
                        <p style="margin-bottom:0.4rem; color:black;">Scan this QR with your UPI app to pay:</p>
                        <div id="upiQr" style="display:flex; align-items:center; justify-content:center; padding:0.5rem;"></div>

                        <!-- Compact minimalistic custom QR area: paste a QR image URL to use your given QR code -->
                        <div style="margin-top:0.6rem; display:flex; gap:0.5rem; justify-content:center; align-items:center;">
                            <input id="customQrUrl" type="text" placeholder="Paste QR image URL" style="flex:1; padding:0.4rem; border:1px solid #ddd; border-radius:6px; font-size:0.9rem;">
                            <button onclick="applyCustomQr()" style="padding:0.45rem 0.7rem; background:#667eea; color:white; border:none; border-radius:6px;">Use</button>
                        </div>

                        <div id="compactUpi" class="compact-qr" style="display:none; margin-top:0.6rem;">
                            <img id="customUpiImg" class="compact-qr-img" src="" alt="Custom QR" style="width:120px; height:120px; border-radius:8px; display:block; margin:0 auto;">
                            <div style="font-size:0.9rem; color:#666; text-align:center; margin-top:0.4rem;">Scan or long-press to pay</div>
                        </div>

                        <button onclick="confirmUpiPayment()" style="margin-top:0.8rem; padding:0.6rem 1rem; background:#10ac84; color:white; border:none; border-radius:6px;">Mark as Paid</button>
                        <div id="upiStatus" style="margin-top:0.5rem; color:#0e9670; font-size:0.9rem;"></div>
                    </div>
                `;

  document.getElementById("paymentSummary").innerHTML = summary;
  toggleCart();
  document.getElementById("paymentModal").classList.add("active");

  // Setup payment method listener
  const pm = document.getElementById("paymentMethod");
  // Try loading a local QR image (from mew_gif folder) first — fallback to generated QR if not found
  function tryLoadLocalMewGifQr(amount) {
    const candidates = [
      "mew_gif/WhatsApp Image 2025-11-12 at 15.26.16_56f97678.jpg",
      "mew_gif/mewmew.gif",
    ];
    let idx = 0;
    function next() {
      if (idx >= candidates.length) {
        // none found, render generated UPI QR
        renderUpiQr(amount);
        return;
      }
      const path = candidates[idx++];
      const tester = new Image();
      tester.onload = function () {
        // show compact custom QR
        const compact = document.getElementById("compactUpi");
        const upiContainer = document.getElementById("upiQr");
        const img = document.getElementById("customUpiImg");
        if (img) img.src = encodeURI(path);
        if (compact) compact.style.display = "block";
        if (upiContainer) upiContainer.style.display = "none";
      };
      tester.onerror = next;
      tester.src = encodeURI(path);
    }
    next();
  }

  pm.addEventListener("change", function () {
    const upi = document.getElementById("upiSection");
    if (this.value === "upi") {
      upi.style.display = "block";
      tryLoadLocalMewGifQr(finalTotal);
    } else {
      upi.style.display = "none";
    }
  });

  // Render PayPal by default
  renderPayPalButton(finalTotal);
}

function handleContactSubmit(e) {
  e.preventDefault();
  alert("Thank you for your interest! We will contact you soon.");
  e.target.reset();
}

window.addEventListener("load", function () {
  const checkInInput = document.getElementById("checkIn");
  const checkOutInput = document.getElementById("checkOut");
  if (checkInInput) checkInInput.min = today;
  if (checkOutInput) checkOutInput.min = today;
  // load persisted cart
  loadCartFromStorage();
  // load booking history and visited places
  loadBookingHistory();
  loadVisitedPlaces();
  // local guide boxed options handler: toggle active button on selection
  const lgButtons = document.querySelectorAll(
    ".local-guide-options .lg-option"
  );
  if (lgButtons && lgButtons.length) {
    lgButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        lgButtons.forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
      });
    });
    // default to opt-out
    const defaultBtn = document.querySelector(
      '.local-guide-options .lg-option[data-value="false"]'
    );
    if (defaultBtn) defaultBtn.classList.add("active");
  }
});

function renderPayPalButton(totalAmount) {
  document.getElementById("paypal-button-container").innerHTML = "";

  paypal
    .Buttons({
      createOrder: function (data, actions) {
        return actions.order.create({
          purchase_units: [
            {
              amount: { value: totalAmount.toFixed(2) },
              description: "Wanderlust Travel Booking",
            },
          ],
        });
      },

      onApprove: function (data, actions) {
        return actions.order.capture().then(function (details) {
          const bookingDetails = cart
            .map(
              (item) =>
                `${item.destination} (${formatDate(
                  item.checkIn
                )} to ${formatDate(item.checkOut)}) - ${item.guests} guest(s)`
            )
            .join("\n");

          alert(
            "🎉 Payment Successful! 🎉\n\n" +
              `Thank you, ${details.payer.name.given_name}!\n\n` +
              "Booking Confirmed:\n" +
              bookingDetails +
              `\n\nTotal Paid: ${totalAmount.toFixed(2)}`
          );

          // Mark bookings as completed and add to history
          cart.forEach((b) => addToBookingHistory(b));
          cart.forEach((b) => addVisitedPlace(b.destination, b.image));

          cart = [];
          updateCart();
          saveCartToStorage();
          closePaymentModal();
        });
      },

      onError: function () {
        alert("Payment failed. Please try again.");
      },
    })
    .render("#paypal-button-container");
}

// Apply coupon code (client-side demo)
function applyCoupon() {
  const input = document.getElementById("couponInput");
  const status = document.getElementById("couponStatus");
  const code = input.value.trim().toUpperCase();
  if (!code) {
    status.textContent = "Enter a coupon code";
    status.style.color = "#e33b4a";
    return;
  }

  const found = offers.find((o) => o.code === code);
  if (!found) {
    status.textContent = "Invalid coupon code";
    status.style.color = "#e33b4a";
    appliedCoupon = null;
    return;
  }

  appliedCoupon = found;
  status.textContent = `Applied ${found.code}: ${found.description}`;
  status.style.color = "#0e9670";

  // Re-open payment to refresh totals with discount
  proceedToPayment();
}

// Render UPI QR using Google Chart API (demo). Replace merchant@upi with real UPI ID in production.
function renderUpiQr(amount) {
  const upiId = "merchant@upi"; // placeholder
  const payeeName = "Wanderlust";
  const currency = "INR";
  const payload = `upi://pay?pa=${encodeURIComponent(
    upiId
  )}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(
    amount.toFixed(2)
  )}&cu=${currency}&tn=${encodeURIComponent("Wanderlust Booking")}`;

  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(
    payload
  )}`;
  const container = document.getElementById("upiQr");
  // render compact-sized QR for minimal look
  container.innerHTML = `<img src="${qrUrl}" alt="UPI QR" style="width:140px; height:140px; border-radius:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.08);">`;

  // hide any custom QR image if present
  const compact = document.getElementById("compactUpi");
  if (compact) compact.style.display = "none";
}

// Simulate UPI confirm (client-only demo) — in production verify payment server-side.
function confirmUpiPayment() {
  const status = document.getElementById("upiStatus");
  status.textContent = "Verifying payment...";
  status.style.color = "#0e9670";

  setTimeout(() => {
    // Assume payment successful in demo
    status.textContent = "Payment received! Booking confirmed.";

    // Add to booking history and visited places
    cart.forEach((b) => addToBookingHistory(b));
    cart.forEach((b) => addVisitedPlace(b.destination, b.image));

    cart = [];
    updateCart();
    saveCartToStorage();
    closePaymentModal();
    alert("🎉 UPI Payment successful — your bookings are confirmed!");
  }, 1200);
}

// Allow user to paste a custom QR image URL and show a compact minimal QR tile
function applyCustomQr() {
  const url = document.getElementById("customQrUrl").value.trim();
  if (!url) return alert("Please paste a valid QR image URL");

  const compact = document.getElementById("compactUpi");
  const upiContainer = document.getElementById("upiQr");
  const img = document.getElementById("customUpiImg");

  if (img) img.src = url;
  if (compact) compact.style.display = "block";
  if (upiContainer) upiContainer.style.display = "none";
}

// Open ticket details modal with full trip information
function openTicketDetails(bookingIndex) {
  const booking = bookingHistory[bookingIndex];
  if (!booking) return;

  // Automatically collapse the booking history modal
  toggleBookingHistory();

  const nights = Math.ceil(
    (new Date(booking.checkOut) - new Date(booking.checkIn)) /
      (1000 * 60 * 60 * 24)
  );
  let totalPrice = booking.price * parseInt(booking.guests) * nights;
  const guideFee = booking.localGuideFee ? Number(booking.localGuideFee) : 0;
  totalPrice += guideFee;
  const completedDate = new Date(booking.completedOn).toLocaleDateString();

  // Generate mock accommodation details based on destination
  const accommodationDetails = generateAccommodationDetails(
    booking.destination
  );

  const detailsHtml = `
                    <div class="ticket-details">
                        <div class="ticket-banner">
                            <img src="${booking.image}" alt="${
    booking.destination
  }" class="ticket-banner-img">
                            <div class="ticket-banner-overlay"></div>
                        </div>

                        <div class="ticket-header-minimal">
                            <h2>${booking.destination}</h2>
                            <p class="ticket-subtitle">Your Amazing Journey Awaits! ✈️</p>
                        </div>

                        <div class="ticket-section">
                            <h4>📅 Trip Duration</h4>
                            <div class="ticket-detail-row">
                                <span>Check-in:</span>
                                <span class="value">${formatDate(
                                  booking.checkIn
                                )}</span>
                            </div>
                            <div class="ticket-detail-row">
                                <span>Check-out:</span>
                                <span class="value">${formatDate(
                                  booking.checkOut
                                )}</span>
                            </div>
                            <div class="ticket-detail-row">
                                <span>Duration:</span>
                                <span class="value">${nights} night${
    nights > 1 ? "s" : ""
  }</span>
                            </div>
                        </div>

                        <div class="ticket-section">
                            <h4>👥 Guests</h4>
                            <div class="ticket-detail-row">
                                <span>Number of Guests:</span>
                                <span class="value">${booking.guests}</span>
                            </div>
                            <div class="ticket-detail-row">
                                <span>Booked On:</span>
                                <span class="value">${completedDate}</span>
                            </div>
                        </div>

                        <div class="ticket-section">
                            <h4>🏨 Residence & Lodging</h4>
                            <p class="accommodation-text">${
                              accommodationDetails.residence
                            }</p>
                            <div class="ticket-detail-row">
                                <span>Room:</span>
                                <span class="value">${
                                  accommodationDetails.roomType
                                }</span>
                            </div>
                            <div class="ticket-detail-row">
                                <span>Amenities:</span>
                                <span class="value">${
                                  accommodationDetails.amenities
                                }</span>
                            </div>
                        </div>

                        <div class="ticket-section">
                            <h4>🍽️ Food Arrangements</h4>
                            <p class="food-text">${
                              accommodationDetails.food
                            }</p>
                            <div class="ticket-detail-row">
                                <span>Meals:</span>
                                <span class="value">${
                                  accommodationDetails.meals
                                }</span>
                            </div>
                        </div>

                        <div class="ticket-section pricing-section">
                            <div class="ticket-detail-row">
                                <span>Rate per Guest/Night:</span>
                                <span class="value">$${booking.price}</span>
                            </div>
                            <div class="ticket-detail-row">
                                <span>Calculation:</span>
                                <span class="value">${
                                  booking.guests
                                } Guest × ${nights} Night</span>
                            </div>
                            ${
                              guideFee > 0
                                ? `<div class="ticket-detail-row"><span>Local Guide Fee:</span><span class="value">$${guideFee.toLocaleString()}</span></div>`
                                : ""
                            }
                            <div class="ticket-detail-row total-price">
                                <span>Total Paid:</span>
                                <span class="value">$${totalPrice.toLocaleString()}</span>
                            </div>
                        </div>

                        ${
                          guideFee > 0 && booking.localGuideNumber
                            ? `<div class="ticket-section"><h4>🧭 Local Guide</h4><div class="ticket-detail-row"><span>Contact:</span><span class="value">${booking.localGuideNumber}</span></div></div>`
                            : ""
                        }

                        <div class="ticket-closing">
                            <p class="closing-quote">✨ Enjoy Your Stay ✨</p>
                        </div>
                    </div>
                `;

  document.getElementById("ticketDetailsContent").innerHTML = detailsHtml;
  document.getElementById("ticketDetailsModal").classList.add("active");
}

// Generate mock accommodation details based on destination
function generateAccommodationDetails(destination) {
  const accommodations = {
    "Paris, France": {
      residence:
        "★★★★★ Luxury Boutique Hotel in the Heart of Paris - Located in the 5th Arrondissement near Notre-Dame Cathedral",
      roomType: "Deluxe Double Room with Eiffel Tower View",
      amenities:
        "Free Wi-Fi, Air Conditioning, Premium Toiletries, 24/7 Concierge Service",
      food: "Indulge in French cuisine at our Michelin-recommended restaurant. Breakfast includes fresh croissants, pastries, and organic produce.",
      meals: "Breakfast Daily, Dinner (5 days), Wine Tasting Experience",
    },
    "Santorini, Greece": {
      residence:
        "★★★★ Cliffside Luxury Resort - Perched on the volcanic cliffs with panoramic Caldera views",
      roomType: "Cave Suite with Private Infinity Pool",
      amenities:
        "Spa, Infinity Pool, Beach Access, Traditional Greek Hospitality",
      food: "Authentic Greek Mediterranean cuisine with fresh seafood and local wines. Private beach dinners available.",
      meals:
        "Continental Breakfast, Lunch Vouchers, Dinner (3 days), Beach Picnic",
    },
    "Swiss Alps": {
      residence:
        "★★★★★ Alpine Luxury Lodge - Nestled in the heart of the Swiss Alps with skiing access",
      roomType: "Premium Mountain Suite with Fireplace & Balcony",
      amenities:
        "Sauna, Hot Tub, Ski Equipment Rental, Mountain Guide Services",
      food: "Swiss and International cuisine. Fondue nights and hearty alpine breakfast served daily.",
      meals:
        "Full Breakfast, Packed Lunch, 4-Course Dinner, Afternoon Tea & Pastries",
    },
    "Dubai, UAE": {
      residence:
        "★★★★★ Ultra-Luxury Beachfront Palace - World-class hospitality in Dubai Marina",
      roomType: "Executive Suite with Marina & Beach View",
      amenities:
        "Private Beach, Infinity Pool, Water Sports, Spa & Wellness Center",
      food: "Fine dining with Michelin-starred chefs. Middle Eastern and International cuisine available 24/7.",
      meals:
        "À la Carte Breakfast, Lunch at Pool, Dinner at Restaurants, Desert Safari Dinner",
    },
    Maldives: {
      residence:
        "★★★★★ Overwater Bungalow Paradise - Direct ocean access with pristine coral reefs",
      roomType: "Sunset Beach Bungalow with Private Plunge Pool",
      amenities:
        "Snorkeling, Diving, Water Spa, Tropical Garden, Stilt Walkways",
      food: "Fresh seafood and tropical fruits. Candlelit beach dinners and underwater dining available.",
      meals:
        "Buffet Breakfast, Lunch, Dinner (5 days), Romantic Beach Dinner (1 night)",
    },
    "Tokyo, Japan": {
      residence:
        "★★★★ Modern Luxury Hotel - Located in the vibrant Shibuya district",
      roomType: "Premium City View Suite with Japanese Garden",
      amenities:
        "Traditional Onsen Bath, Cultural Activities, City Guide Service, Karaoke Bar",
      food: "Michelin-starred Japanese and fusion cuisine. Sushi classes and ramen tours included.",
      meals:
        "Japanese Breakfast, Lunch at Local Restaurants, Dinner (4 days), Tea Ceremony Experience",
    },
  };

  return (
    accommodations[destination] || {
      residence: "★★★★ Premium Hotel - Carefully selected for your comfort",
      roomType: "Deluxe Room with All Modern Amenities",
      amenities: "Wi-Fi, Air Conditioning, 24/7 Service, Room Service",
      food: "Enjoy diverse cuisine at our in-house restaurant and local eateries.",
      meals: "Breakfast Daily, Dinner (3 days)",
    }
  );
}

// Close ticket details modal
function closeTicketDetails() {
  document.getElementById("ticketDetailsModal").classList.remove("active");
}

// Delete a completed trip from booking history
function deleteCompletedTrip(index) {
  if (confirm("Are you sure you want to delete this trip from your history?")) {
    bookingHistory.splice(index, 1);
    saveBookingHistory();
    updateHistoryCount();
    displayCompletedBookings();
  }
}

// Delete a wishlist item
function deleteWishlistItem(index) {
  if (
    confirm(
      "Are you sure you want to remove this destination from your wishlist?"
    )
  ) {
    visitedPlaces.splice(index, 1);
    saveVisitedPlaces();
    updateHistoryCount();
    displayVisitedPlaces();
  }
}

// Smooth scroll
(function () {
  const nav = document.querySelector("nav");
  const headerOffset = () => (nav ? nav.offsetHeight : 0);

  document.addEventListener("click", function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href || href === "#") return;

    const target = document.querySelector(href);
    if (!target) return;

    if (a.classList && a.classList.contains("no-smooth")) return;

    e.preventDefault();

    const y =
      target.getBoundingClientRect().top +
      window.pageYOffset -
      headerOffset() -
      6;

    window.scrollTo({
      top: y < 0 ? 0 : y,
      behavior: "smooth",
    });

    const cartEl = document.getElementById("cartModal");
    const overlay = document.getElementById("cartOverlay");
    cartEl && cartEl.classList.remove("active");
    overlay && overlay.classList.remove("active");
  });
})();
