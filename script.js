'use strict';

const form = document.querySelector('.form');
const sidebar = document.querySelector('.sidebar');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const workouts = document.querySelector('.workouts');
const formBtn = document.querySelector('.form__btn');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
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
  #markers = [];
  constructor() {
    // Get users position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Event Listeners
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
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

  _addEventWorkout() {
    if (this._eventHandlerAdded) {
      return;
    }

    const workoutList = document.querySelector('.workouts');

    workoutList.addEventListener('click', e => {
      if (!e.target.closest('.workout')) return;

      const workoutIndex = e.target.closest('.workout').dataset.index;

      if (e.target.classList.contains('deleteButton')) {
        this._deleteWorkout(e, workoutIndex);
      } else if (e.target.classList.contains('editButton')) {
        this._editWorkout(e, workoutIndex);
      }
    });

    this._eventHandlerAdded = true;
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
    e.stopImmediatePropagation();

    // Get workout data
    const [closestWorkout, workoutIndex] = [...this._getWorkoutData(e)];

    // Delete from form
    closestWorkout.remove();

    // Remove Marker
    this.removeWorkoutMarker(this.#workouts[workoutIndex].marker);

    //Delete from data
    this.#workouts.splice(workoutIndex, 1);
    this.#markers.splice(workoutIndex, 1);

    // Update storage
    this._setLocalStorage();
  }

  _editWorkout(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    // Get workout data
    const [closestWorkout, workoutIndex, workout] = this._getWorkoutData(e);

    // Open form
    this.#mapEvent = {
      latlng: { lat: workout[0].coords[0], lng: workout[0].coords[1] },
    };
    this._showForm(this.#mapEvent);

    // Delete original workout & remove marker
    closestWorkout.remove();
    this.removeWorkoutMarker(this.#markers[workoutIndex]);

    //Delete from data
    this.#workouts.splice(workoutIndex, 1);

    // Update storage
    this._setLocalStorage();
  }

  _deleteAll() {
    const allWorkouts = document.querySelectorAll('.workout');
    const deleteAllBtn = document.querySelector('.deleteAllButton');

    // Remove workouts from form & map
    allWorkouts.forEach(workout => workout.remove());
    // this.#markers.forEach(marker => this.removeWorkoutMarker(marker));

    this.#workouts.forEach(workout => this.removeWorkoutMarker(workout.marker));

    //Reset data
    this.#workouts = [];
    // this.#markers = [];

    //remove Delete button
    if (deleteAllBtn) deleteAllBtn.remove();

    // Update storage
    this._setLocalStorage();
  }

  // _addDeleteButton() {
  //   const deleteAllBtn = document.querySelectorAll('.deleteAllButton');
  //   const htmlDelete = `<button class="deleteAllButton">DELETE ALL</button>`;

  //   if (this.#workouts.length > 1 && deleteAllBtn.length < 1) {
  //     // Insert HTML
  //     workouts.insertAdjacentHTML('beforeend', htmlDelete);

  //     // Add event listener
  //     const deleteAllBtn1 = document.querySelector('.deleteAllButton');
  //     deleteAllBtn1.addEventListener('click', this._deleteAll.bind(this));
  //   }
  // }

  _addDeleteButton() {
    const workouts = document.querySelector('.workouts');

    if (
      this.#workouts.length > 1 &&
      !workouts.querySelector('.deleteAllButton')
    ) {
      const htmlDelete = `<button class="deleteAllButton">DELETE ALL</button>`;
      workouts.insertAdjacentHTML('beforeend', htmlDelete);

      workouts.addEventListener('click', e => {
        if (e.target.classList.contains('deleteAllButton')) {
          this._deleteAll();
        }
      });
    }
  }

  _sortWorkouts(e) {
    // Get all workout elements
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

  _addSortDropdown() {
    // Get all the existing .sort elements (there should be zero or one)
    const sortBoxes = document.querySelectorAll('.sort');

    // Define the HTML code for the sort dropdown
    const sortDropdownHTML = `
      <span>
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
      sidebar.insertAdjacentHTML('beforeend', sortDropdownHTML);

      // Add an event listener to the new .sort element
      const sortBox = document.querySelector('.sort');
      sortBox.addEventListener('change', this._sortWorkouts.bind(this));
    }
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

      this.#workouts.forEach(workout => {
        this.renderWorkoutMarker(workout);
      });
    }
  }

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

  _newWorkout(e) {
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

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if data is cycling create cycling obj
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Input have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this.renderWorkoutMarker(workout);

    // Render new workout on the list
    this.renderWorkout(workout);

    this._addEventWorkout();

    // Hide form and clear input fields
    this._hideForm();

    //Set local storage
    this._setLocalStorage();
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

    // this.#markers.push(marker);

    if (this.#workouts.length > 0) {
      this.#workouts[this.#workouts.length - 1] = {
        ...this.#workouts[this.#workouts.length - 1],
        marker: marker,
      };
    }
  }

  renderWorkout(workout) {
    const type = workout.type;
    let html = `<li class="workout workout--${type}" data-id="${workout.id}">
    <h2 class="workout__title">${
      workout.description
    } <button class="editButton">Edit</button>
    <button class="deleteButton">Delete</button></h2>
    
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
      <span class="workout__icon">⚡️</span>
      <span class="workout__value">${workout.pace.toFixed(1)}</span>
      <span class="workout__unit">min/km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">🦶🏼</span>
      <span class="workout__value">${workout.cadence}</span>
      <span class="workout__unit">spm</span>
    </div>
  </li>`;

    if (type === 'cycling')
      html += `
    <div class="workout__details">
    <span class="workout__icon">⚡️</span>
    <span class="workout__value">${workout.speed}</span>
    <span class="workout__unit">km/h</span>
  </div>
  <div class="workout__details">
    <span class="workout__icon">⛰</span>
    <span class="workout__value">${workout.elevationGain}</span>
    <span class="workout__unit">m</span>
  </div>
  </li>`;
    form.insertAdjacentHTML('afterend', html);
    this._addDeleteButton();
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
    // workout.click();
  }

  // _setLocalStorage() {
  //   localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  // }

  // This will emove any circular references in the object, which can cause issues when attempting to stringify the object

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
    this.#workouts.forEach(workout => {
      this.renderWorkout(workout);
    });
    // Add event listeners
    this._addEventWorkout();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}
const app = new App();
