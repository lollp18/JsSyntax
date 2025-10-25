<html name="main-app">
    <script>
      ({
        data: {
          user1: { name: "Alice", age: 30 },
          user2: { name: "Bob", age: 42 }
        }
      })
    </script>
    <css>
        div {
            padding: 1rem;
            background-color: #f0f0f0;
        }
        button {
            margin-bottom: 1rem;
        }
    </css>
    <div>
        <h1>User List</h1>

        <button data-action:click="increment(user1.age)">Happy Birthday, Alice!</button>
        
        <user-card v-bind:username="user1.name" v-bind:userage="user1.age"></user-card>
        
        <user-card v-bind:username="user2.name" v-bind:userage="user2.age"></user-card>

    </div>
</html>
