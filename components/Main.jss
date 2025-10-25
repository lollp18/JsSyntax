<html name="main-app">
    <script>
      ({
        data: {
          count: 0,
          showMessage: true
        },
        methods: {
          increment() {
            this.count++;
          },
          toggleMessage() {
            this.showMessage = !this.showMessage;
          }
        }
      })
    </script>
    <css>
      div{
        border: 2px solid blue;
        padding: 10px;
      }
    </css>
    <div>
        <h1>Hallo from Main app</h1>
        <p>Count: {{count}}</p>
        <button data-event-increment="click">+1</button>
        <hr>
        <button data-event-toggleMessage="click">Toggle Message</button>
        <div data-if="showMessage">
            <p>This message is shown conditionally!</p>
        </div>
    </div>
</html>
