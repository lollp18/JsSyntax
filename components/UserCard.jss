<html name="user-card">
    <script>
      ({
        props: ['username', 'userage'],
        data: {}
      })
    </script>
    <css>
        div {
            border: 1px solid #ccc;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 8px;
            background-color: #f9f9f9;
        }
        h3 {
            margin: 0 0 0.5rem 0;
            color: #333;
        }
    </css>
    <div>
        <h3>{{ username }}</h3>
        <p>Age: {{ userage }}</p>
    </div>
</html>
