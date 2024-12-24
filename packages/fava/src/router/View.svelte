<script lang="ts">
  import { useNavigation } from "./router";
  const navigation = useNavigation();
  const NavComponent = $derived(navigation.activeRoute.route.component);
  const params = $derived(navigation.activeRoute.properties.params);
</script>

<div>
  <NavComponent {...params}></NavComponent>
</div>
