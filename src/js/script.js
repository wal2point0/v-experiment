// Voice Restaurant App
$(function() {
  const store = window.RedLanternStore;

  // Data
  let foodMenu = (store && store.getCachedMenu()) || [
    { id: 1, name: '🍕 Pizza', desc: 'Cheese pizza', price: 12.99, number: 1 },
    { id: 2, name: '🍔 Burger', desc: 'Juicy burger', price: 10.99, number: 2 },
    { id: 3, name: '🍜 Pasta', desc: 'Italian pasta', price: 13.99, number: 3 }
  ];
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let orders = (store && store.getCachedOrders()) || JSON.parse(localStorage.getItem('orders')) || [];

  async function refreshMenuData() {
    if (!store) return;
    foodMenu = await store.getMenu();
  }

  async function refreshOrdersData() {
    if (!store) return;
    orders = await store.getOrders();
  }
  
  // DOM selectors
  const intro = $('#introduction');
  const main = $('#mainContent');
  const cards = $('#cards');
  const cartBadge = $('.cart-count');
  const cartItems = $('#cartItems');
  const cartEmpty = $('#cartEmpty');
  const cartTotal = $('#cartTotal');
  const voiceStart = $('#voiceStartBtn');
  const voiceStop = $('#voiceStopBtn');
  const voiceAssistantToggle = $('#voiceAssistantToggle');
  const voiceStatus = $('#voiceStatus');
  const finalSpan = $('#final_span');
  const interimSpan = $('#interim_span');
  
  // Admin functionality is handled in admin.js
  
  // Device detection
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|BlackBerry/i.test(navigator.userAgent);
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const safariAssistantAudio = {
    intro: new Audio('../assets/audio/introSpeech.mp3'),
    anythingElse: new Audio('../assets/audio/anythingElse.mp3'),
    cart: new Audio('../assets/audio/cartSpeech.mp3')
  };
  
  // Voice Recognition
  let recognition;
  let finalTranscript = '';
  let assistantHasWelcomed = false;
  let awaitingAssistantResponse = false;
  let commandHandledDuringRecognition = false;
  let assistantResponseRetryCount = 0;
  let pendingAssistantResponseText = '';
  let speechRecognitionSupported = true;
  let voiceAssistantEnabled = localStorage.getItem('voiceAssistantEnabled') !== 'false';
  const spokenNumbers = {
    oh: 0,
    zero: 0,
    one: 1,
    won: 1,
    two: 2,
    to: 2,
    too: 2,
    three: 3,
    four: 4,
    for: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    ate: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100
  };

  function getPreferredAssistantVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    // Prefer British English Victoria specifically, then fall back to en-GB voices.
    const victoriaBritish = voices.find(v => /victoria/i.test(v.name) && /^en(-|_)gb$/i.test(v.lang));
    if (victoriaBritish) return victoriaBritish;

    const victoriaAnyEnglish = voices.find(v => /victoria/i.test(v.name) && /^en(-|_)/i.test(v.lang));
    if (victoriaAnyEnglish) return victoriaAnyEnglish;

    const britishFemaleLike = voices.find(v => /^en(-|_)gb$/i.test(v.lang) && /(female|woman|karen|moira|susan|serena|google uk english female)/i.test(v.name));
    if (britishFemaleLike) return britishFemaleLike;

    const britishVoice = voices.find(v => /^en(-|_)gb$/i.test(v.lang));
    if (britishVoice) return britishVoice;

    const englishVoice = voices.find(v => /^en(-|_)/i.test(v.lang));
    return englishVoice || voices[0];
  }

  function stopSafariAssistantAudio() {
    Object.values(safariAssistantAudio).forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {
        console.warn('Could not stop Safari assistant audio:', e);
      }
    });
  }

  function playSafariAssistantAudio(clipKey, listenAfter = false) {
    if (!isSafariBrowser) return false;
    const audio = safariAssistantAudio[clipKey];
    if (!audio) return false;

    stopSafariAssistantAudio();

    const startListeningAfterClip = function() {
      if (!listenAfter) return;
      voiceStatus.text('🎤 Listening for your response...');
      assistantResponseRetryCount = 0;
      startVoiceRecognition();
    };

    audio.onended = startListeningAfterClip;
    audio.onerror = function() {
      console.warn('Safari assistant audio failed to play:', clipKey);
      startListeningAfterClip();
    };

    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function(err) {
          console.warn('Safari assistant audio play blocked:', err);
          startListeningAfterClip();
        });
      }
      return true;
    } catch (e) {
      console.warn('Could not start Safari assistant audio:', e);
      startListeningAfterClip();
      return false;
    }
  }

  function setVoiceAssistantEnabled(enabled, persist = true) {
    voiceAssistantEnabled = !!enabled;
    if (persist) {
      localStorage.setItem('voiceAssistantEnabled', String(voiceAssistantEnabled));
    }

    if (voiceAssistantToggle.length) {
      voiceAssistantToggle.prop('checked', voiceAssistantEnabled);
    }

    if (!voiceAssistantEnabled) {
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      pendingAssistantResponseText = '';
      finalTranscript = '';
      commandHandledDuringRecognition = false;
      stopSafariAssistantAudio();

      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          console.warn('Could not stop voice recognition:', e);
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      voiceStart.prop('disabled', true);
      voiceStop.prop('disabled', true);
      voiceStatus.text('🔇 Voice assistant is off');
      return;
    }

    if (!speechRecognitionSupported) {
      voiceStart.prop('disabled', true);
      voiceStop.prop('disabled', true);
      voiceStatus.text('⚠️ Voice not supported in this browser');
      return;
    }

    voiceStart.prop('disabled', false);
    voiceStop.prop('disabled', true);
    voiceStatus.text('Ready for voice input');
  }

  function speakAssistantIntro(forceReplay = false) {
    if (!voiceAssistantEnabled) {
      return;
    }
    if (!window.speechSynthesis) {
      return;
    }
    if (!forceReplay && assistantHasWelcomed) {
      return;
    }

    if (playSafariAssistantAudio('intro')) {
      assistantHasWelcomed = true;
      return;
    }

    const introText = 'Welcome to Red Lantern Manor. You can say, add dumplings, add number two, or add two chicken fried rice. Say show cart to review your basket, then press checkout when you are ready.';
    const utterance = new SpeechSynthesisUtterance(introText);
    const preferredVoice = getPreferredAssistantVoice();
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang || 'en-GB';
    } else {
      utterance.lang = 'en-GB';
    }
    utterance.rate = 1;
    utterance.pitch = 1.1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    assistantHasWelcomed = true;
  }

  function startVoiceRecognition() {
    if (!voiceAssistantEnabled) {
      voiceStatus.text('🔇 Voice assistant is off');
      return;
    }
    if (!recognition) {
      return;
    }

    try {
      finalTranscript = '';
      commandHandledDuringRecognition = false;
      pendingAssistantResponseText = '';
      recognition.continuous = !awaitingAssistantResponse;
      recognition.interimResults = awaitingAssistantResponse;
      recognition.start();
      if (voiceStop) voiceStop.prop('disabled', false);
    } catch (e) {
      console.warn('Could not restart voice recognition:', e);
    }
  }

  function speakAssistantFollowUp(text, listenAfter = false, safariClipKey = null) {
    if (!voiceAssistantEnabled) {
      return;
    }

    if (safariClipKey && playSafariAssistantAudio(safariClipKey, listenAfter)) {
      return;
    }

    if (!window.speechSynthesis) {
      if (listenAfter) {
        startVoiceRecognition();
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = getPreferredAssistantVoice();
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang || 'en-GB';
    } else {
      utterance.lang = 'en-GB';
    }
    utterance.rate = 1;
    utterance.pitch = 1.1;

    if (listenAfter) {
      utterance.onend = function() {
        voiceStatus.text('🎤 Listening for your response...');
        assistantResponseRetryCount = 0;
        startVoiceRecognition();
      };
    }

    window.speechSynthesis.speak(utterance);
  }

  function initVoiceAssistant() {
    if (!window.speechSynthesis) {
      return;
    }

    // Ensure voice list is populated across browsers.
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function() {
      window.speechSynthesis.getVoices();
    };
  }
  
  function initVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speechRecognitionSupported = false;
      voiceStatus.text('⚠️ Voice not supported in this browser');
      voiceStart.prop('disabled', true);
      console.error('Speech Recognition API not available');
      return;
    }
    
    try {
      recognition = new SpeechRecognition();
      recognition.lang = 'en-GB';
      recognition.maxAlternatives = 5;
      recognition.continuous = true; // keep listening for better mobile recognition
      recognition.interimResults = false; // use final transcripts to reduce noise on mobile
      if (isMobile) {
        voiceStatus.text('🎤 Mobile mode: speak clearly and pause after phrase');
      }
      console.log('✓ Speech recognition initialized successfully');
    } catch (e) {
      console.error('Error initializing speech recognition:', e);
      voiceStatus.text('⚠️ Error initializing voice');
      voiceStart.prop('disabled', true);
      return;
    }
    
    recognition.onstart = function() {
      voiceStatus.text('🎤 Listening...');
      if (voiceStop) voiceStop.prop('disabled', false);
      finalSpan.text('');
      interimSpan.text('');
    };
    
    recognition.onresult = function(event) {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      finalSpan.text(finalTranscript.trim());
      interimSpan.text(interim);

      if (awaitingAssistantResponse) {
        const quickResponse = normalizeVoiceCommand(`${finalTranscript} ${interim}`.trim());
        if (isNegativeResponse(quickResponse)) {
          commandHandledDuringRecognition = true;
          pendingAssistantResponseText = quickResponse;
          finalTranscript = quickResponse;
          recognition.stop();
        }
      }
    };
    
    recognition.onend = function() {
      voiceStatus.text('✓ Done listening');
      if (voiceStop) voiceStop.prop('disabled', true);
      if (pendingAssistantResponseText) {
        const responseText = pendingAssistantResponseText;
        pendingAssistantResponseText = '';
        processVoiceCommand(responseText);
        finalTranscript = '';
        commandHandledDuringRecognition = false;
        return;
      }

      if (!finalTranscript.trim() && awaitingAssistantResponse && assistantResponseRetryCount < 1) {
        assistantResponseRetryCount++;
        voiceStatus.text('🎤 Listening for your response...');
        setTimeout(startVoiceRecognition, 150);
        return;
      }

      if (finalTranscript.trim() && !commandHandledDuringRecognition) {
        processVoiceCommand(finalTranscript);
      } else if (commandHandledDuringRecognition && finalTranscript.trim()) {
        processVoiceCommand(finalTranscript);
      }
      finalTranscript = '';
      commandHandledDuringRecognition = false;
      pendingAssistantResponseText = '';
    };
    
    recognition.onerror = function(event) {
      voiceStatus.text('❌ Error: ' + event.error);
    };
  }
  
  function processVoiceCommand(text) {
    text = text.toLowerCase().trim();
    console.log('Processing voice command:', text);
    const normalizedVoiceText = normalizeVoiceCommand(text);

    if (awaitingAssistantResponse && isNegativeResponse(normalizedVoiceText)) {
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      new bootstrap.Modal(document.getElementById('modalCart')).show();
      finalSpan.text('🛒 Here is your cart. Please confirm your order and checkout when you are ready.');
      speakAssistantFollowUp('Here is your cart. Please confirm your order and checkout when you are ready.', false, 'cart');
      return;
    }

    const numberMatch = extractMenuNumber(text);
    const addQuantity = extractAddQuantity(text);
    const parsedAddItems = parseAddItemsFromCommand(text);
    const hasExplicitMenuNumberCue = /\b(number|item|option|order)\b/.test(text);
    console.log('extractMenuNumber returned:', numberMatch);
    console.log('extractAddQuantity returned:', addQuantity);
    console.log('parseAddItemsFromCommand returned:', parsedAddItems.map(item => ({ name: item.food.name, quantity: item.quantity })));
    console.log('Menu numbers available:', foodMenu.map(f => ({ name: f.name, number: f.number, numberType: typeof f.number })));
    const isOrderByNumberCommand = numberMatch !== null && /\b(add|order|orders|number|item|menu|option)\b/.test(text);
    
    if (normalizedVoiceText.includes('add') || isOrderByNumberCommand) {
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      if (parsedAddItems.length >= 1) {
        parsedAddItems.forEach(item => addToCart(item.food, item.quantity));
        const summary = parsedAddItems
          .map(item => `${item.quantity} x ${item.food.name}`)
          .join(', ');
        finalSpan.text(`✓ Added ${summary} to cart!`);
        awaitingAssistantResponse = true;
        speakAssistantFollowUp('Anything else?', true, 'anythingElse');
        console.log('Added multiple items to cart:', parsedAddItems);
        return;
      }

      // Try to match by number first
      let foundFood = null;
      if (numberMatch !== null && hasExplicitMenuNumberCue) {
        foundFood = foodMenu.find(f => Number(f.number) === numberMatch);
        console.log('Food lookup for number', numberMatch, '→', foundFood ? foundFood.name : 'NOT FOUND');
      }
      // If not found by number, try by name
      if (!foundFood) {
        foundFood = findFoodByName(text);
      }
      if (foundFood) {
        addToCart(foundFood, addQuantity);
        if (addQuantity > 1) {
          finalSpan.text(`✓ Added ${addQuantity} x ${foundFood.name} to cart!`);
        } else {
          finalSpan.text('✓ Added ' + foundFood.name + ' to cart!');
        }
        awaitingAssistantResponse = true;
        speakAssistantFollowUp('Anything else?', true, 'anythingElse');
        console.log('Added to cart:', foundFood.name, 'qty:', addQuantity);
      } else {
        finalSpan.text('❌ Could not find that item. Try: "add dumplings", "add number 15", or tap Help for examples.');
        console.log('No matching food found in:', foodMenu.map(f => f.name));
      }
    } else if (isShowCartCommand(normalizedVoiceText)) {
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      new bootstrap.Modal(document.getElementById('modalCart')).show();
      finalSpan.text('📭 Opening cart...');
    } else if (isCartMention(normalizedVoiceText)) {
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      new bootstrap.Modal(document.getElementById('modalCart')).show();
      finalSpan.text('📭 Opening cart...');
    } else if (normalizedVoiceText.includes('menu')) {
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      finalSpan.text('📋 Here is our menu');
    } else {
      if (awaitingAssistantResponse && assistantResponseRetryCount < 1) {
        assistantResponseRetryCount++;
        voiceStatus.text('🎤 Listening for your response...');
        setTimeout(startVoiceRecognition, 150);
        return;
      }
      awaitingAssistantResponse = false;
      assistantResponseRetryCount = 0;
      finalSpan.text('⚠️ Command not recognized. Try: "add pizza", "show cart", or "show menu"');
      console.log('Unrecognized command:', text);
    }
  }

  function normalizeVoiceCommand(text) {
    return text
      .toLowerCase()
      .replace(/\bcard\b/g, 'cart')
      .replace(/\bcourt\b/g, 'cart')
      .replace(/\bcarte\b/g, 'cart')
      .replace(/\bcards\b/g, 'cart')
      .replace(/\bcarts\b/g, 'cart')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isShowCartCommand(text) {
    return /\b(show|open|view|check)\b/.test(text) && /\bcart\b/.test(text);
  }

  function isCartMention(text) {
    return /\bcart\b/.test(text);
  }

  function isNegativeResponse(text) {
    return /\b(no|know|now|nope|nah|nothing else|that'?s all|that is all|all done|done)\b/.test(text);
  }

  function normalizeCommandText(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalizeToken(token) {
    if (!token) return token;
    if (token.length > 4 && token.endsWith('ies')) {
      return token.slice(0, -3) + 'y';
    }
    if (token.length > 4 && token.endsWith('es')) {
      return token.slice(0, -2);
    }
    if (token.length > 3 && token.endsWith('s')) {
      return token.slice(0, -1);
    }
    return token;
  }

  function tokenizeCanonical(text) {
    return normalizeCommandText(text)
      .split(' ')
      .filter(Boolean)
      .map(canonicalizeToken);
  }

  function resolveFoodReference(commandText) {
    const hasExplicitMenuNumberCue = /\b(number|item|option|order)\b/.test(commandText);
    const numberMatch = extractMenuNumber(commandText);
    if (numberMatch !== null && hasExplicitMenuNumberCue) {
      return foodMenu.find(f => Number(f.number) === numberMatch) || null;
    }

    return findFoodByName(commandText);
  }

  function parseAddItemsFromCommand(commandText) {
    const normalized = spokenToDigits(
      normalizeVoiceCommand(commandText)
        .replace(/#/g, ' number ')
        .replace(/\s+/g, ' ')
        .trim()
    );

    const addMatch = normalized.match(/\badd\b\s+(.+)/);
    if (!addMatch) {
      return [];
    }

    const addBody = addMatch[1].trim();
    // Collapse "number 15" → "number@15" so the digit part doesn't
    // trigger the segment-split lookahead prematurely (restored after).
    const collapsedBody = addBody.replace(/\b(number|item|option|order)\s+(\d{1,3})\b/g, '$1@$2');
    const segmentMatches = [...collapsedBody.matchAll(/(?:^|\s)(\d{1,2})\s+(.+?)(?=(?:\s+\d{1,2}\s+)|$)/g)];
    if (!segmentMatches.length) {
      return [];
    }

    const parsedItems = [];
    for (const match of segmentMatches) {
      const quantity = Math.max(1, Math.min(99, parseInt(match[1], 10)));
      const rawSegment = match[2]
        .replace(/\band\b\s*$/g, '')
        .replace(/@/g, ' ')   // restore "number@15" → "number 15"
        .trim();

      if (!rawSegment) {
        continue;
      }

      const resolvedFood = resolveFoodReference(rawSegment);
      if (!resolvedFood) {
        continue;
      }

      parsedItems.push({ food: resolvedFood, quantity });
    }

    return parsedItems;
  }

  function stripLeadingAddQuantity(text) {
    const normalized = normalizeCommandText(text);
    const normalizedWithDigits = spokenToDigits(normalized);
    return normalizedWithDigits
      .replace(/^add\s+\d{1,2}\s+(x\s+)?(of\s+)?/, 'add ')
      .trim();
  }

  function findFoodByName(commandText) {
    const normalizedCommand = stripLeadingAddQuantity(commandText);
    const commandTokenSet = new Set(tokenizeCanonical(normalizedCommand));
    let bestMatch = null;

    for (let food of foodMenu) {
      const cleanFoodName = normalizeCommandText(food.name.replace(/[^\w\s]|_/g, ''));
      if (!cleanFoodName) continue;

      if (normalizedCommand.includes(cleanFoodName)) {
        const score = 100 + cleanFoodName.length;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { food, score };
        }
      }
    }

    if (bestMatch) {
      return bestMatch.food;
    }

    // Filter common stop words so conjunctions like "and" in a food name
    // (e.g. "Beef with Ginger and Spring Onion") don't unfairly boost scores.
    const STOP_WORDS = new Set(['a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'the', 'with', 'add']);
    const filteredCommandTokens = new Set([...commandTokenSet].filter(w => !STOP_WORDS.has(w)));

    for (let food of foodMenu) {
      const foodWords = tokenizeCanonical(food.name).filter(w => w.length > 2 && !STOP_WORDS.has(w));
      if (!foodWords.length) continue;
      const matchedWords = foodWords.filter(word => filteredCommandTokens.has(word)).length;
      if (matchedWords > 0) {
        // Normalise by food-name length so a shorter, more-precise match
        // ranks above a longer name with the same raw matched-word count.
        const score = (matchedWords / foodWords.length) * 100 + matchedWords * 10;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { food, score };
        }
      }
    }

    return bestMatch ? bestMatch.food : null;
  }

  // Convert every spoken-number variant to its digit string so a simple
  // regex can extract the menu number regardless of what the STT engine returns.
  function spokenToDigits(text) {
    return text
      // Split-word teen forms that some STT engines emit (must come first)
      .replace(/\bthir\s+teen\b/gi, '13')
      .replace(/\bfour\s+teen\b/gi, '14')
      .replace(/\bfif\s+teen\b/gi, '15')
      .replace(/\bsix\s+teen\b/gi, '16')
      .replace(/\bseven\s+teen\b/gi, '17')
      .replace(/\beigh\s+teen\b/gi, '18')
      .replace(/\bnine\s+teen\b/gi, '19')
      // Full teen words (longest first to avoid partial matches)
      .replace(/\bnineteen\b/gi, '19')
      .replace(/\beighteen\b/gi, '18')
      .replace(/\bseventeen\b/gi, '17')
      .replace(/\bsixteen\b/gi, '16')
      .replace(/\bfifteen\b/gi, '15')
      .replace(/\bfourteen\b/gi, '14')
      .replace(/\bthirteen\b/gi, '13')
      .replace(/\btwelve\b/gi, '12')
      .replace(/\beleven\b/gi, '11')
      .replace(/\bten\b/gi, '10')
      // Tens
      .replace(/\bninety\b/gi, '90')
      .replace(/\beighty\b/gi, '80')
      .replace(/\bseventy\b/gi, '70')
      .replace(/\bsixty\b/gi, '60')
      .replace(/\bfifty\b/gi, '50')
      .replace(/\bforty\b/gi, '40')
      .replace(/\bthirty\b/gi, '30')
      .replace(/\btwenty\b/gi, '20')
      // Units
      .replace(/\bnine\b/gi, '9')
      .replace(/\b(?:eight|ate)\b/gi, '8')
      .replace(/\bseven\b/gi, '7')
      .replace(/\bsix\b/gi, '6')
      .replace(/\bfive\b/gi, '5')
      .replace(/\b(?:four|for)\b/gi, '4')
      .replace(/\bthree\b/gi, '3')
      .replace(/\b(?:two|to|too)\b/gi, '2')
      .replace(/\b(?:one|won)\b/gi, '1')
      .replace(/\b(?:zero|oh)\b/gi, '0')
      // Combine "tens digit" + "units digit" pairs written as separate tokens
      // e.g. "20 5" → "25"
      .replace(/\b(20|30|40|50|60|70|80|90)\s+(1|2|3|4|5|6|7|8|9)\b/g,
        function(_, tens, ones) { return String(parseInt(tens, 10) + parseInt(ones, 10)); });
  }

  function extractMenuNumber(text) {
    const normalized = spokenToDigits(
      text.toLowerCase().replace(/#/g, ' number ')
    );
    console.log('Normalized for number extraction:', normalized);

    // Prefer number that follows a cue word
    const cueMatch = normalized.match(/\b(?:number|item|option|order)\s+(\d{1,3})\b/);
    if (cueMatch) return parseInt(cueMatch[1], 10);

    // Fallback: any isolated number in the phrase
    const digitMatch = normalized.match(/\b(\d{1,3})\b/);
    if (digitMatch) return parseInt(digitMatch[1], 10);

    return null;
  }

  function extractAddQuantity(text) {
    const normalized = spokenToDigits(
      text.toLowerCase().replace(/#/g, ' number ')
    );

    // Examples: "add two number 15", "add 3 item 1", "add 2 of number 7"
    const quantityByNumberCue = normalized.match(/\badd\s+(\d{1,2})\s+(?:x\s+)?(?:of\s+)?(?:number|item|option|order)\b/);
    if (quantityByNumberCue) {
      return Math.max(1, Math.min(99, parseInt(quantityByNumberCue[1], 10)));
    }

    // Examples: "add two dumplings", "add 3 pizza", "add 2x noodles"
    const quantityByName = normalized.match(/\badd\s+(\d{1,2})\s+(?:x\s+)?(?:of\s+)?(?!number\b|item\b|option\b|order\b)[a-z]/);
    if (quantityByName) {
      return Math.max(1, Math.min(99, parseInt(quantityByName[1], 10)));
    }

    return 1;
  }
  
  // Admin functionality relocated to admin.js
  
  // Add to cart
  function addToCart(food, quantity = 1) {
    const safeQty = Math.max(1, Math.min(99, Number(quantity) || 1));
    let item = cart.find(i => i.id == food.id);
    if (item) {
      item.qty += safeQty;
    } else {
      // Exclude the image field — base64 images are large and quickly exhaust
      // the 5 MB localStorage quota when stored inside every cart entry.
      const { image, ...foodWithoutImage } = food;
      cart.push({...foodWithoutImage, qty: safeQty});
    }
    saveCart();
    updateCart();
  }
  
  // Save cart to localStorage
  function saveCart() {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded — cart could not be saved.', e);
        finalSpan.text('⚠️ Storage full. Remove some items or clear browser storage.');
      } else {
        throw e;
      }
    }
  }
  
  // Update cart display
  function updateCart() {
    const total = cart.reduce((s, i) => s + i.qty, 0);
    cartBadge.text(total);
    
    if (cart.length === 0) {
      cartItems.empty();
      cartEmpty.show();
      cartTotal.text('£0.00');
    } else {
      cartEmpty.hide();
      cartItems.empty();
      
      cart.forEach(item => {
        const itemTotal = (item.price * item.qty).toFixed(2);
        const row = `
          <div class="card mb-2">
            <div class="card-body p-2">
              <div class="cart-item-row">
                <div class="cart-item-main">
                  <h6 class="mb-0">${item.name}</h6>
                  <small>£${item.price.toFixed(2)}</small>
                </div>
                <div class="cart-item-qty">
                  <button class="btn btn-xs btn-outline qty-minus" data-id="${item.id}">−</button>
                  <span class="mx-1">${item.qty}</span>
                  <button class="btn btn-xs btn-outline qty-plus" data-id="${item.id}">+</button>
                </div>
                <div class="cart-item-total">£${itemTotal}</div>
                <div class="cart-item-remove">
                  <button class="btn btn-xs btn-danger remove" data-id="${item.id}">✕</button>
                </div>
              </div>
            </div>
          </div>
        `;
        cartItems.append(row);
      });
      
      $('.qty-plus').click(function() {
        const id = $(this).data('id');
        const item = cart.find(i => i.id == id);
        if (item) item.qty++;
        saveCart();
        updateCart();
      });
      
      $('.qty-minus').click(function() {
        const id = $(this).data('id');
        const item = cart.find(i => i.id == id);
        if (item) {
          item.qty--;
          if (item.qty <= 0) cart = cart.filter(i => i.id != id);
        }
        saveCart();
        updateCart();
      });
      
      $('.remove').click(function() {
        const id = $(this).data('id');
        cart = cart.filter(i => i.id != id);
        saveCart();
        updateCart();
      });
      
      const sum = cart.reduce((s, i) => s + (i.price * i.qty), 0);
      cartTotal.text('£' + sum.toFixed(2));
    }
  }
  
  
  // Render menu
  function renderMenu() {
    cards.empty();
    foodMenu.forEach(food => {
      const card = `
        <div class="col">
          <div class="card food-card h-100">
            <div class="card-body text-center">
              ${food.image ? `<img src="${food.image}" alt="${food.name}" style="width:140px;height:140px;object-fit:cover;object-position:center;display:block;margin:auto;margin-bottom:10px;border-radius:12px;">` : `<div style="font-size: 2rem; margin-bottom: 10px;">${food.name.split(' ')[0]}</div>`}
              <h5 class="card-title">#${food.number} ${food.name}</h5>
              <p class="card-text text-muted">${food.desc}</p>
              <h6 class="text-warning">£${food.price.toFixed(2)}</h6>
            </div>
            <div class="card-footer bg-transparent">
              <button class="chinese-start-button chinese-cart-button add-btn" data-id="${food.id}" type="button">
                <span class="chinese-start-button-text">Add to Cart</span>
                <span class="chinese-start-button-background-wrapper">
                  <span class="chinese-start-button-background"></span>
                </span>
                <span class="chinese-start-button-bottom-wrapper">
                  <span class="chinese-start-button-bottom"></span>
                </span>
              </button>
            </div>
          </div>
        </div>
      `;
      cards.append(card);
    });
    
    $('.add-btn').click(function() {
      const id = $(this).data('id');
      const food = foodMenu.find(f => f.id == id);
      addToCart(food);
    });
  }
  
  // Show main content
  $('#introButton').click(async function() {
    speakAssistantIntro();
    intro.hide();
    main.fadeIn();
    await refreshMenuData();
    renderMenu();
  });
  
  voiceStart.click(function() {
    if (!voiceAssistantEnabled) {
      voiceStatus.text('🔇 Voice assistant is off');
      return;
    }
    startVoiceRecognition();
  });

  voiceStop.click(function() {
    if (recognition) {
      recognition.stop();
      voiceStatus.text('⏹️ Stopped listening');
      voiceStop.prop('disabled', true);
    }
  });
  
  // Checkout
  $('#btnCheckout').click(async function() {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    const total = parseFloat(cartTotal.text().replace('£', ''));
    const order = {
      items: [...cart],
      total: total,
      date: new Date().toISOString()
    };
    
    if (store) {
      await store.createOrder(order);
      await refreshOrdersData();
    } else {
      orders.push(order);
      localStorage.setItem('orders', JSON.stringify(orders));
    }
    
    alert('Thank you for your order! Total: £' + total.toFixed(2));
    cart = [];
    saveCart();
    updateCart();
  });
  
  // Setup stop button visibility for all devices
  voiceStop.show();
  voiceStop.prop('disabled', true);

  voiceAssistantToggle.on('change', function() {
    setVoiceAssistantEnabled($(this).is(':checked'));
  });

  initVoiceAssistant();
  initVoice();
  setVoiceAssistantEnabled(voiceAssistantEnabled, false);
  refreshMenuData();
  refreshOrdersData();
  updateCart();
});
