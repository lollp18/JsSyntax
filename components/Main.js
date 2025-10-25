counter: 0
name: "Alice"


<html name="counter-component">
  <div>
    <h1>Zähler: {{ counter }}</h1>
    <button data-event-increment="click">+1</button>
  </div>
</html>

<html name="nested-component">
  <div>
    <h2>Willkommen, {{ name }}</h2>
    <counter-component></counter-component>
  </div>
</html>

