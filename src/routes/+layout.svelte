<!-- App shell — wraps every page. Imports global styles and renders page content. -->

<script>
	import '../app.css';

	let { children } = $props();
</script>

{@render children()}
