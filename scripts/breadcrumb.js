export const updateBreadcrumb = (title) => {
  const breadcrumbNav = document.querySelector(".breadcrumb-nav");
  if (!breadcrumbNav || !title) return;
  
  // Remove existing dynamic breadcrumb items
  breadcrumbNav.querySelectorAll(".breadcrumb-dynamic").forEach(el => el.remove());
  
  // Add new breadcrumb items
  breadcrumbNav.insertAdjacentHTML("beforeend", `
    <div class="breadcrumb-item separator breadcrumb-dynamic">/</div>
    <span class="breadcrumb-item current breadcrumb-dynamic">${title}</span>
  `);
};