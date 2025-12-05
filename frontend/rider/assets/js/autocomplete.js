// Autocomplete functionality for address inputs

// Get user's current location
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Could not get user location:', error);
        reject(error);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

export function setupAutocomplete(geocodingService, notificationManager) {
  const pickupInput = document.getElementById('pickupInput');
  const dropInput = document.getElementById('dropInput');
  const pickupDropdown = document.getElementById('pickupDropdown');
  const dropDropdown = document.getElementById('dropDropdown');

  // Setup autocomplete for pickup
  if (pickupInput && pickupDropdown) {
    setupAutocompleteField(pickupInput, pickupDropdown, 'pickup', geocodingService, notificationManager);
  }

  // Setup autocomplete for drop
  if (dropInput && dropDropdown) {
    setupAutocompleteField(dropInput, dropDropdown, 'drop', geocodingService, notificationManager);
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      pickupDropdown?.classList.remove('active');
      dropDropdown?.classList.remove('active');
    }
  });
}

function setupAutocompleteField(input, dropdown, fieldType, geocodingService, notificationManager) {
  let selectedIndex = -1;

  // Input event - search as user types
  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (query.length < 3) {
      dropdown.classList.remove('active');
      dropdown.innerHTML = '';
      return;
    }

    // Show loading state
    dropdown.innerHTML = '<div class="autocomplete-loading">🔍 Searching...</div>';
    dropdown.classList.add('active');

    // Get user's current location for proximity-based search
    getUserLocation().then(userLocation => {
      // Debounced search with user location
      geocodingService.debouncedSearch(query, (results) => {
        displayAutocompleteResults(results, dropdown, input, fieldType, notificationManager);
        selectedIndex = -1;
      }, userLocation);
    }).catch(() => {
      // Fallback without user location
      geocodingService.debouncedSearch(query, (results) => {
        displayAutocompleteResults(results, dropdown, input, fieldType, notificationManager);
        selectedIndex = -1;
      });
    });
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      highlightAutocompleteItem(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      highlightAutocompleteItem(items, selectedIndex);
    } else if (e.key === 'Enter' && dropdown.classList.contains('active')) {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('active');
    }
  });

  // Focus event
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 3 && dropdown.children.length > 0) {
      dropdown.classList.add('active');
    }
  });
}

function displayAutocompleteResults(results, dropdown, input, fieldType, notificationManager) {
  if (!results || results.length === 0) {
    dropdown.innerHTML = '<div class="autocomplete-empty">❌ No locations found nearby</div>';
    return;
  }

  dropdown.innerHTML = '';
  
  results.forEach((result, index) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.dataset.lat = result.lat;
    item.dataset.lng = result.lng;
    item.dataset.displayName = result.displayName;
    
    // Get location type icon and category badge
    const icon = getLocationIcon(result.type, result.category);
    const categoryBadge = getCategoryBadge(result.type, result.category);
    
    // Extract main location name and secondary details
    const parts = result.displayName.split(',');
    const mainText = parts[0].trim();
    const subText = parts.slice(1, 3).join(',').trim(); // Show only first 2 parts for cleaner UI
    
    // Add distance badge if available (priority indicator)
    const distanceBadge = result.distance !== undefined ? 
      `<span class="autocomplete-distance ${result.distance < 5 ? 'nearby' : ''}">${result.distance < 1 ? Math.round(result.distance * 1000) + 'm' : result.distance.toFixed(1) + ' km'}</span>` : '';
    
    item.innerHTML = `
      <span class="autocomplete-icon">${icon}</span>
      <div class="autocomplete-content">
        <div class="autocomplete-main">
          ${mainText}
          ${categoryBadge}
          ${distanceBadge}
        </div>
        <div class="autocomplete-sub">${subText}</div>
      </div>
    `;
    
    item.addEventListener('click', () => {
      input.value = result.displayName;
      input.dataset.lat = result.lat;
      input.dataset.lng = result.lng;
      dropdown.classList.remove('active');
      
      notificationManager?.show(`✅ ${fieldType === 'pickup' ? 'Pickup' : 'Drop'} location selected`, 'success');
      
      // Trigger input event to update fare estimate
      input.dispatchEvent(new Event('change'));
    });
    
    dropdown.appendChild(item);
  });
}

function getCategoryBadge(type, category) {
  const badges = {
    'railway': '🚉 Metro/Railway',
    'aeroway': '✈️ Airport',
    'station': '🚉 Station',
    'metro': '🚇 Metro',
    'subway': '🚇 Metro',
    'bus_station': '🚏 Bus Station',
    'mall': '🛍️ Mall',
    'shopping_centre': '🛍️ Mall',
    'hospital': '🏥 Hospital',
    'university': '🎓 University',
    'school': '🏫 School',
    'stadium': '🏟️ Stadium',
    'park': '🌳 Park',
    'monument': '🗿 Monument',
    'museum': '🏛️ Museum',
    'cinema': '🎬 Cinema'
  };

  // Check type first
  for (const [key, badge] of Object.entries(badges)) {
    if (type?.toLowerCase().includes(key)) {
      return `<span class="autocomplete-badge">${badge}</span>`;
    }
  }

  // Check category
  if (category === 'railway') return '<span class="autocomplete-badge">🚉 Station</span>';
  if (category === 'aeroway') return '<span class="autocomplete-badge">✈️ Airport</span>';
  if (category === 'amenity') return '<span class="autocomplete-badge">📍 Place</span>';
  
  return '';
}

function highlightAutocompleteItem(items, index) {
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

function getLocationIcon(type, category) {
  // Priority icons based on category and type
  if (category === 'railway' || type?.includes('station') || type?.includes('metro') || type?.includes('subway')) {
    return '🚇';
  }
  if (category === 'aeroway' || type?.includes('airport')) {
    return '✈️';
  }
  
  const icons = {
    house: '🏠',
    building: '🏢',
    shop: '🏪',
    restaurant: '🍽️',
    hotel: '🏨',
    hospital: '🏥',
    school: '🏫',
    university: '🎓',
    park: '🌳',
    station: '🚇',
    railway: '🚇',
    metro: '🚇',
    subway: '�',
    airport: '✈️',
    bus_stop: '🚏',
    bus_station: '🚏',
    cafe: '☕',
    bank: '🏦',
    cinema: '🎬',
    mall: '🛍️',
    shopping_centre: '🛍️',
    stadium: '🏟️',
    monument: '🗿',
    museum: '🏛️',
    city: '🏙️',
    town: '🏘️',
    village: '🏡',
    road: '🛣️',
    street: '📍',
    administrative: '🏛️',
    suburb: '🏘️',
    neighbourhood: '🏘️'
  };
  
  return icons[type] || '📍';
}
