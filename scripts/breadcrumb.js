// Update breadcrumb navigation with dynamic title
export const updateBreadcrumb = (title) => {
  const breadcrumbNav = document.querySelector(".breadcrumb-nav");
  if (!breadcrumbNav || !title) return; // No breadcrumb container or title

  // Remove existing dynamic breadcrumb items (separator and current page)
  breadcrumbNav
    .querySelectorAll(".breadcrumb-dynamic")
    .forEach((el) => el.remove());

  // Add new breadcrumb items (separator + current page title)
  breadcrumbNav.insertAdjacentHTML(
    "beforeend",
    `
    <div class="breadcrumb-item separator breadcrumb-dynamic">/</div>
    <span class="breadcrumb-item current breadcrumb-dynamic">${title}</span>
  `,
  );
};

// Flow: updateBreadcrumb (remove old dynamic items) → add new separator & title
