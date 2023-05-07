'use strict';

const form = document.querySelector('.form');
const sidebar = document.querySelector('.sidebar');
const sortDeleteContainer = document.querySelector('.sortDeleteContainer');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const formBtn = document.querySelector('.form__btn');
const deleteAllBtn = document.querySelector('.deleteAllButton');
const overlay = document.querySelector('.overlay');
const messageContainer = document.querySelector('.message-container');
const spinnerContainer = document.querySelector('.spinner-container');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  marker = null;
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance;
    this.duration = duration;
  }

  async cityLocation() {
    const [lat, lng] = [...this.coords];
    try {
      const response = await fetch(
        `https://geocode.xyz/${lat},${lng}?geoit=json&auth=36350363082749418844x8665`
      );
      const data = await response.json();

      return data.city;
    } catch (err) {
      console.error(`${err} 💥`);
    }
  }

  async getWeather() {
    try {
      const [lat, lng] = [...this.coords];
      const response = await fetch(
        `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=5b767a584ee07a8b0841986f556904db`
      );
      const data = await response.json();
      const icon = data.weather[0].icon;
      const link = `https://openweathermap.org/img/wn/${icon}@2x.png`;
      const img = document.createElement('img');
      // img.src = link;
      // img.classList.add('weather-icon');
      this.weather = link;
      // console.log(this.weather);
      // console.log(img);
      return img;
    } catch (err) {
      console.error(`${err} 💥`);
    }
  }

  async _setDescription() {
    try {
      // prettier-ignore
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      // Wait for method to get city name
      const city = await this.cityLocation();

      this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} ${
        city ? 'in' : ''
      } ${city ? city : ''} on ${
        months[this.date.getMonth()]
      } ${this.date.getDate()}`;
    } catch (err) {
      console.error(`${err} 💥`);
    }
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km

    this.pace = this.duration / this.distance;
    console.log(this.pace);
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//---------APPLICATION ARCHITECTURE---------------
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #eventHandlerAdded = false;
  constructor() {
    // Get users position
    this._getPosition();

    // Query Selectors
    this.containerWorkouts = document.querySelector('.workouts');

    // Event Listeners
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    this.containerWorkouts.addEventListener(
      'click',
      this._moveToPopup.bind(this)
    );
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    {
      const { latitude } = position.coords;
      const { longitude } = position.coords;

      const coords = [latitude, longitude];

      this.#map = L.map('map', {
        center: [latitude, longitude],
        zoom: this.#mapZoomLevel,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.#map);

      // Handle clicks on map
      this.#map.on('click', this._showForm.bind(this));

      // Get data from local storage
      this._getLocalStorage();
    }
  }

  // _addEventWorkout() {
  //   const editBtn = document.querySelectorAll('.editButton');
  //   const deleteBtn = document.querySelectorAll('.deleteButton');

  //   editBtn.forEach(btn =>
  //     btn.addEventListener('click', this._editWorkout.bind(this))
  //   );
  //   deleteBtn.forEach(btn =>
  //     btn.addEventListener('click', this._deleteWorkout.bind(this))
  //   );
  // }

  _addEventWorkout(workoutList) {
    if (this.#eventHandlerAdded) {
      return;
    }

    // const workoutList = document.querySelector('.workouts');

    workoutList.addEventListener('click', e => {
      if (!e.target.closest('.workout')) return;

      if (e.target.classList.contains('delete-button')) {
        this._deleteWorkout(e);
      } else if (e.target.classList.contains('edit-button')) {
        this._editWorkout(e);
      }
    });

    this.#eventHandlerAdded = true;
  }

  _getWorkoutData(e) {
    const closestWorkout = e.target.closest('.workout');

    const workoutIndex = this.#workouts.findIndex(
      work => work.id === closestWorkout.dataset.id
    );

    const workout = this.#workouts.filter(
      work => work.id === closestWorkout.dataset.id
    );

    return [closestWorkout, workoutIndex, workout];
  }

  _deleteWorkout(e) {
    e.preventDefault();
    // e.stopImmediatePropagation();
    const deleteAllBtn = document.querySelector('.deleteAllButton');
    const sortParent = document.querySelector('.sort-parent');

    // Get workout data
    const [closestWorkout, workoutIndex] = this._getWorkoutData(e);

    // Delete from form
    closestWorkout.remove();

    // Remove Marker
    this.removeWorkoutMarker(this.#workouts[workoutIndex].marker);

    //Delete from data
    this.#workouts.splice(workoutIndex, 1);

    // Remove delete all button if only 1 workout
    if (this.#workouts.length < 2 && this.#workouts.length > 0) {
      deleteAllBtn.remove();
      sortParent.remove();
    }

    // Display message
    this.displayMessage('Workout removed', 1);

    // Update storage
    this._setLocalStorage();
  }

  _editWorkout(e) {
    e.preventDefault();
    // e.stopImmediatePropagation();

    // Get workout data
    const [closestWorkout, workoutIndex, workout] = this._getWorkoutData(e);

    // Open form
    this.#mapEvent = {
      latlng: { lat: workout[0].coords[0], lng: workout[0].coords[1] },
    };
    this._showForm(this.#mapEvent);

    // Focus on form
    inputDistance.focus();

    // Delete original workout & remove marker
    closestWorkout.remove();
    this.removeWorkoutMarker(this.#workouts[workoutIndex].marker);

    //Delete from data
    this.#workouts.splice(workoutIndex, 1);

    // Update storage
    this._setLocalStorage();
  }

  _addDeleteAllButton() {
    // const workouts = document.querySelector('.workouts');

    if (
      this.#workouts.length > 1 &&
      !sidebar.querySelector('.deleteAllButton')
    ) {
      const htmlDelete = `<button class="deleteAllButton">Delete all</button>`;
      sortDeleteContainer.insertAdjacentHTML('beforeend', htmlDelete);

      sidebar.addEventListener('click', e => {
        if (e.target.classList.contains('deleteAllButton')) {
          this._deleteAll();
        }
      });
    }
  }

  _deleteAll() {
    const allWorkouts = document.querySelectorAll('.workout');
    const deleteAllBtn = document.querySelector('.deleteAllButton');
    const sortParent = document.querySelector('.sort-parent');

    // Remove workouts from form & map
    [...allWorkouts].forEach(workout => workout.remove());
    this.#workouts.forEach(workout => this.removeWorkoutMarker(workout.marker));

    //Reset data
    this.#workouts = [];

    //remove Delete button
    if (deleteAllBtn) deleteAllBtn.remove();

    // Remove Sort button
    if (sortParent) sortParent.remove();

    // Workout removed message
    this.displayMessage('All workouts removed', 1);

    // Update storage
    this._setLocalStorage();
  }

  _addSortDropdown() {
    // Define the HTML code for the sort dropdown
    const sortDropdownHTML = `
      <span class="sort-parent">
        <label for="sort">Sort by:</label>
        <select name="sort" class="sort">
          <option value="empty"></option>
          <option value="distance">Distance</option>
          <option value="duration">Duration</option>
        </select>
      </span>`;

    // Check if there is more than one workout and if the sort dropdown has not been added yet
    if (this.#workouts.length > 1 && !document.querySelector('.sort')) {
      // Insert the sort dropdown HTML code before the end of the sidebar element
      sortDeleteContainer.insertAdjacentHTML('beforeend', sortDropdownHTML);

      // Select the new sort dropdown menu
      const sortBox = document.querySelector('.sort');

      // Add an event listener to the new .sort element
      sortBox.addEventListener('change', this._sortWorkouts.bind(this));
    }
  }

  _sortWorkouts(e) {
    // Select workouts
    const allWorkouts = document.querySelectorAll('.workout');

    // Get the sorting option chosen by the user
    const sortChoice = e.target.value;

    // Remove all workout elements from the DOM
    allWorkouts.forEach(workout => workout.remove());

    // Sort the workouts based on the user's choice
    const sorted =
      sortChoice === 'distance' || sortChoice === 'duration'
        ? this.#workouts.slice().sort((a, b) => b[sortChoice] - a[sortChoice])
        : this.#workouts;

    // Render the sorted workouts
    sorted.forEach(workout => this.renderWorkout(workout));
  }

  // _addSortDropdown() {
  //   const sortBox = document.querySelectorAll('.sort');
  //   const htmlSort = `
  //     <span><label for="sort">Sort by:</label><select name="sort" class="sort">
  //   <option value="empty"></option>
  //   <option value="distance">Distance</option>
  //   <option value="duration">Duration</option>
  //     </select></span>`;

  //   if (this.#workouts.length > 1 && sortBox.length < 1) {
  //     // Insert HTML
  //     sidebar.insertAdjacentHTML('beforeend', htmlSort);

  //     // Add Event listener
  //     const sortBox1 = document.querySelector('.sort');
  //     sortBox1.addEventListener('change', this._sortWorkouts.bind(this));
  //   }
  // }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    //Empty Inputs
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';

    // To give affect of form changing to workout
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  async _newWorkout(e) {
    try {
      e.preventDefault();

      const validInputs = (...inputs) =>
        inputs.every(inp => Number.isFinite(inp));
      const allPositive = (...inputs) => inputs.every(inp => inp > 0);

      // Get data from the form
      const type = inputType.value;
      const distance = +inputDistance.value;
      const duration = +inputDuration.value;
      const { lat, lng } = this.#mapEvent.latlng;
      let workout;

      // Check if data is valid

      // if data is runing create running obj
      if (type === 'running') {
        const cadence = +inputCadence.value;
        // Check if data is valid
        if (
          // !Number.isFinite(distance) ||
          // !Number.isFinite(duration) ||
          // !Number.isFinite(cadence)
          !validInputs(distance, duration, cadence) ||
          !allPositive(distance, duration, cadence)
        )
          return alert('Input have to be positive numbers!');

        // Show loading spinner
        this._displaySpinner();

        // Create workout
        workout = new Running([lat, lng], distance, duration, cadence);
        await workout.cityLocation();
        await workout.getWeather();
      }

      // if data is cycling create cycling obj
      if (type === 'cycling') {
        const elevation = +inputElevation.value;
        if (
          !validInputs(distance, duration, elevation) ||
          !allPositive(distance, duration)
        )
          return alert('Input have to be positive numbers!');

        // Show loading spinner
        this._displaySpinner();

        // Create workout
        workout = new Cycling([lat, lng], distance, duration, elevation);
        await workout.cityLocation();
        await workout.getWeather();
      }

      // Add new object to workout array
      this.#workouts.push(workout);

      // Render workout on map as marker
      this.renderWorkoutMarker(workout);

      // Hide form and clear input fields
      this._hideForm();

      // Render new workout on the list
      this.renderWorkout(workout);

      // Hide spinner
      this.removeSpinner();

      // Display workout added message
      this.displayMessage(
        `${workout.type === 'running' ? 'Run' : 'Cycle'} added 💪`,
        2
      );

      // Add event listners to new workout
      this._addEventWorkout(this.containerWorkouts);

      //Set local storage
      this._setLocalStorage();
    } catch (err) {
      console.error(`err 💥`);
    }
  }

  _displaySpinner() {
    overlay.classList.remove('hidden');
    spinnerContainer.classList.remove('hidden');
  }

  removeSpinner() {
    overlay.classList.add('hidden');
    spinnerContainer.classList.add('hidden');
  }

  displayMessage(message, duration) {
    const seconds = duration * 1000;
    overlay.classList.remove('hidden');
    messageContainer.classList.remove('hidden');

    // Clear message box
    messageContainer.innerHTML = '';

    // Add message
    const html = `<p class="inner-message">${message}</p>`;
    messageContainer.insertAdjacentHTML('afterbegin', html);

    // Set time out
    setTimeout(() => {
      overlay.classList.add('hidden');
      messageContainer.classList.add('hidden');
    }, seconds);
  }

  removeWorkoutMarker(marker) {
    marker.remove();
  }

  renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    // This will create a cicrular reference
    workout.marker = marker;

    // BUG
    // if (this.#workouts.length > 0) {
    //   this.#workouts[this.#workouts.length - 1] = {
    //     ...this.#workouts[this.#workouts.length - 1],
    //     marker: marker,
    //   };
    //   console.log(this.#workouts);
    // }
  }

  renderWorkout(workout) {
    const type = workout.type;
    let html = `
    
    <li class="workout workout--${type}" data-id="${workout.id}">

    <div class="deleteEditIcons">
    <button class="editButton"><img src="edit-button-green.png" alt="edit button" class="edit-button"/></button>
    <button class="deleteButton"><img src="x-button.png" alt="edit button" class="delete-button"/></button>
    </div>
    
    <h2 class="workout__title">${workout.description}</h2>   

    <div class="workout__weather">
    <img src="${
      workout.weather
    }" class="weather-icon"><span class="weather__unit">weather</span>
    </div>

    <div class="workout__details">
      <span class="workout__icon">${type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.duration}</span>
      <span class="workout__unit">min</span>
    </div>`;

    if (type === 'running')
      html += `
    
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
  </li>`;

    if (type === 'cycling')
      html += `
    <div class="workout__details">
    <span class="workout__icon">⚡️</span>
    <span class="workout__value">${workout.speed.toFixed(1)}</span>
    <span class="workout__unit">km/h</span>
  </div>
  <div class="workout__details">
    <span class="workout__icon">⛰</span>
    <span class="workout__value">${workout.elevationGain}</span>
    <span class="workout__unit">m</span>
  </div>
  </li>`;
    form.insertAdjacentHTML('afterend', html);
    this._addDeleteAllButton();
    this._addSortDropdown();
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    if (!workout) return;
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animite: true,
      pan: {
        duration: 1,
      },
    });

    // Using the public interface
    workout.click();
    // console.log(workout.clicks);
  }

  // _setLocalStorage() {
  //   localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  // }

  // This will remove any circular references in the object, which can cause issues when attempting to stringify the object

  _setLocalStorage() {
    localStorage.setItem(
      'workouts',
      JSON.stringify(this.#workouts, (key, value) => {
        if (key === 'marker') {
          return null;
        }
        return value;
      })
    );
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;
    this.#workouts = data;
    this.#workouts
      .filter(workout => workout.type === 'running')
      .forEach(workout => {
        // This will now inherit the prototypes
        Object.setPrototypeOf(workout, Running.prototype);
        // Render workouts on form
        this.renderWorkout(workout);
        // Render markers on the map
        this.renderWorkoutMarker(workout);
      });
    this.#workouts
      .filter(workout => workout.type === 'cycling')
      .forEach(workout => {
        // This will now inherit the prototypes
        Object.setPrototypeOf(workout, Cycling.prototype);
        // Render workouts on form
        this.renderWorkout(workout);
        // Render markers on the map
        this.renderWorkoutMarker(workout);
      });
    // Add event listeners
    this._addEventWorkout(this.containerWorkouts);
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}
const app = new App();
