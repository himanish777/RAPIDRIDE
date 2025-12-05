// Ride Module - Manages ride state and operations
export class RideManager {
  constructor() {
    this.currentRide = null;
    this.rideStatus = null;
    this.etaInterval = null;
    this.locationInterval = null;
  }

  // Start a new ride
  startRide(rideData) {
    this.currentRide = {
      id: rideData._id || rideData.id, // Support both _id (MongoDB) and id
      pickup: rideData.pickupLocation?.address || rideData.pickup,
      drop: rideData.dropoffLocation?.address || rideData.drop,
      rideType: rideData.type || rideData.rideType,
      fare: rideData.fare,
      driver: rideData.driver || null,
      status: rideData.status || 'searching',
      requestedAt: new Date(rideData.createdAt || Date.now()),
      startedAt: rideData.startedAt ? new Date(rideData.startedAt) : null,
      completedAt: rideData.completedAt ? new Date(rideData.completedAt) : null
    };

    this.updateStatus(this.currentRide.status);
    console.log('🚕 Ride started:', this.currentRide);
  }

  // Update ride status
  updateStatus(status) {
    if (!this.currentRide) return;

    this.rideStatus = status;
    this.currentRide.status = status;

    console.log(`📊 Ride status updated: ${status}`);

    // Trigger status-specific actions
    switch (status) {
      case 'searching':
        this.handleSearching();
        break;
      case 'assigned':
        this.handleAssigned();
        break;
      case 'arriving':
        this.handleArriving();
        break;
      case 'on_trip':
        this.handleOnTrip();
        break;
      case 'completed':
        this.handleCompleted();
        break;
      case 'cancelled':
        this.handleCancelled();
        break;
    }
  }

  // Handle searching state
  handleSearching() {
    console.log('🔍 Searching for available drivers...');
    // Could add visual feedback here
  }

  // Handle assigned state
  handleAssigned() {
    console.log('✅ Driver assigned');
    if (this.currentRide.driver) {
      console.log('Driver details:', this.currentRide.driver);
    }
  }

  // Handle arriving state
  handleArriving() {
    console.log('🚗 Driver is arriving...');
    this.startETACountdown();
  }

  // Handle on trip state
  handleOnTrip() {
    console.log('🛣️ Trip in progress');
    this.currentRide.startedAt = new Date();
    this.startLocationTracking();
  }

  // Handle completed state
  handleCompleted() {
    console.log('🏁 Ride completed');
    this.currentRide.completedAt = new Date();
    this.stopTracking();
    
    // Calculate ride duration
    if (this.currentRide.startedAt) {
      const duration = this.currentRide.completedAt - this.currentRide.startedAt;
      this.currentRide.duration = Math.floor(duration / 60000); // minutes
      console.log(`Ride duration: ${this.currentRide.duration} minutes`);
    }
  }

  // Handle cancelled state
  handleCancelled() {
    console.log('❌ Ride cancelled');
    this.stopTracking();
  }

  // Start ETA countdown
  startETACountdown(initialETA = 5) {
    if (this.etaInterval) {
      clearInterval(this.etaInterval);
    }

    let remainingMinutes = initialETA;
    
    this.etaInterval = setInterval(() => {
      if (remainingMinutes > 0) {
        console.log(`⏱️ ETA: ${remainingMinutes} minutes`);
        remainingMinutes--;
      } else {
        console.log('Driver should be arriving now');
        clearInterval(this.etaInterval);
        this.etaInterval = null;
      }
    }, 60000); // Update every minute
  }

  // Start location tracking
  startLocationTracking() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }

    // Track location every 10 seconds
    this.locationInterval = setInterval(() => {
      this.getCurrentLocation();
    }, 10000);

    // Get initial location
    this.getCurrentLocation();
  }

  // Get current location
  getCurrentLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };

          console.log('📍 Location updated:', location);
          
          // Here you would emit location to socket
          // this.socketManager.updateLocation(location);
        },
        (error) => {
          console.error('Location error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  }

  // Stop all tracking
  stopTracking() {
    if (this.etaInterval) {
      clearInterval(this.etaInterval);
      this.etaInterval = null;
    }

    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }

    console.log('⏹️ Tracking stopped');
  }

  // Assign driver to ride
  assignDriver(driverData) {
    if (!this.currentRide) return;

    this.currentRide.driver = {
      id: driverData.id,
      name: driverData.name,
      phone: driverData.phone,
      rating: driverData.rating,
      vehicle: driverData.vehicle,
      location: driverData.location
    };

    this.updateStatus('assigned');
    console.log('👤 Driver assigned:', this.currentRide.driver);
  }

  // Update driver location
  updateDriverLocation(location) {
    if (!this.currentRide || !this.currentRide.driver) return;

    this.currentRide.driver.location = location;
    console.log('🚗 Driver location updated:', location);
  }

  // Update fare
  updateFare(fare) {
    if (!this.currentRide) return;

    this.currentRide.fare = fare;
    console.log('💰 Fare updated:', fare);
  }

  // End ride
  endRide() {
    console.log('🏁 Ending ride:', this.currentRide?.id);
    
    this.stopTracking();
    const completedRide = { ...this.currentRide };
    this.currentRide = null;
    this.rideStatus = null;

    return completedRide;
  }

  // Cancel ride
  cancelRide(reason) {
    if (!this.currentRide) return;

    console.log('❌ Cancelling ride:', this.currentRide.id, 'Reason:', reason);
    
    this.currentRide.cancelledAt = new Date();
    this.currentRide.cancellationReason = reason;
    
    this.updateStatus('cancelled');
    this.endRide();
  }

  // Get current ride
  getCurrentRide() {
    return this.currentRide;
  }

  // Get ride status
  getStatus() {
    return this.rideStatus;
  }

  // Check if ride is active
  isRideActive() {
    return this.currentRide !== null;
  }

  // Calculate ride cost
  calculateCost(distance, duration, rideType) {
    const baseFares = {
      economy: 50,
      comfort: 80,
      premium: 120,
      shared: 40
    };

    const perKmRates = {
      economy: 10,
      comfort: 15,
      premium: 22,
      shared: 8
    };

    const perMinRates = {
      economy: 1,
      comfort: 1.5,
      premium: 2,
      shared: 0.8
    };

    const baseFare = baseFares[rideType] || baseFares.economy;
    const perKmRate = perKmRates[rideType] || perKmRates.economy;
    const perMinRate = perMinRates[rideType] || perMinRates.economy;

    const distanceCost = distance * perKmRate;
    const timeCost = duration * perMinRate;
    const totalCost = baseFare + distanceCost + timeCost;

    return {
      baseFare,
      distanceCost,
      timeCost,
      total: Math.round(totalCost)
    };
  }

  // Estimate fare
  estimateFare(distance, rideType) {
    // Assume average speed of 30 km/h
    const estimatedDuration = (distance / 30) * 60; // minutes
    
    const cost = this.calculateCost(distance, estimatedDuration, rideType);
    
    // Add 20% variance for estimate range
    const minFare = Math.round(cost.total * 0.9);
    const maxFare = Math.round(cost.total * 1.1);

    return {
      min: minFare,
      max: maxFare,
      estimated: cost.total
    };
  }

  // Get ride summary
  getRideSummary() {
    if (!this.currentRide) return null;

    return {
      id: this.currentRide.id,
      pickup: this.currentRide.pickup,
      drop: this.currentRide.drop,
      fare: this.currentRide.fare,
      duration: this.currentRide.duration,
      distance: this.calculateDistance(),
      driver: this.currentRide.driver,
      status: this.currentRide.status,
      requestedAt: this.currentRide.requestedAt,
      startedAt: this.currentRide.startedAt,
      completedAt: this.currentRide.completedAt
    };
  }

  // Calculate distance (placeholder - would use real coordinates)
  calculateDistance() {
    // In real app, calculate using coordinates
    return Math.round(Math.random() * 20 + 5); // Random 5-25 km
  }

  // Check for route deviation
  checkRouteDeviation(currentLocation, plannedRoute) {
    // In real app, check if current location deviates from planned route
    // This is a simplified placeholder
    const deviation = Math.random() > 0.95; // 5% chance of deviation
    
    if (deviation) {
      console.warn('⚠️ Route deviation detected');
      return true;
    }
    
    return false;
  }
}

export default RideManager;