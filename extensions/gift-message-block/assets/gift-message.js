(function () {
  "use strict";

  var WARN_THRESHOLD = 20;
  var PROXY_PATH = "/apps/gift-message";
  var MESSAGE_PROPERTY = "Gift Message";
  var MESSAGE_REFERENCE_PROPERTY = "Gift Message Ref";
  var REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  var REFERENCE_LENGTH = 5;

  function initBlock(block) {
    if (block.dataset.gmbInitialized === "true") return;
    block.dataset.gmbInitialized = "true";

    var toggle = block.querySelector(".gmb-check");
    var field = block.querySelector(".gmb-panel");
    var textarea = block.querySelector(".gmb-message");
    var senderInput = block.querySelector(".gmb-from");
    var recipientInput = block.querySelector(".gmb-to");
    var messageIdInput = block.querySelector(".gmb-message-id");
    var remaining = block.querySelector(".gmb-count-left");
    var saving = block.querySelector(".gmb-status");
    var saveButton = block.querySelector(".gmb-save-button");
    var savedSummary = block.querySelector("[data-gmb-saved-summary]");
    var editButton = block.querySelector(".gmb-edit-button");
    var removeButtons = block.querySelectorAll(
      ".gmb-remove-button, .gmb-summary-remove-button",
    );

    if (!toggle || !field || !textarea) {
      return;
    }

    var mode = block.dataset.mode;
    var cartToken = block.dataset.cartToken || "";
    var manualSave = block.dataset.manualSave === "true";
    var hasSavedMessage = block.dataset.hasSavedMessage === "true";
    var isDirty = false;
    var lineItemPropertiesEnabled =
      block.dataset.lineItemProperties !== "false";
    var productId = block.dataset.productId || "";
    var productTitle = block.dataset.productTitle || "";
    var productHandle = block.dataset.productHandle || "";
    var productVariants = getProductVariants();
    var maxLen = parseInt(textarea.getAttribute("maxlength"), 10) || 250;
    var lastProductCheckoutIntentAt = 0;
    var cartReference = "";

    // ── Character counter ────────────────────────────────────────────────
    function updateCounter() {
      if (!remaining) return;
      var left = maxLen - textarea.value.length;
      remaining.textContent = left;
      if (left <= WARN_THRESHOLD) {
        remaining.setAttribute("data-warn", "");
      } else {
        remaining.removeAttribute("data-warn");
      }
    }

    textarea.addEventListener("input", updateCounter);
    updateCounter();

    // ── Toggle ───────────────────────────────────────────────────────────
    function setPanelOpen(open) {
      field.hidden = !open;
      field.toggleAttribute("hidden", !open);
      field.toggleAttribute("data-gmb-open", open);
      field.style.display = open ? "" : "none";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");

      if (mode === "product") {
        textarea.disabled = !open;
        if (senderInput) senderInput.disabled = !open;
        if (recipientInput) recipientInput.disabled = !open;
        if (messageIdInput) messageIdInput.disabled = !open;
      }
    }

    function handleToggleChange() {
      var checked = toggle.checked;
      setPanelOpen(checked);

      if (manualSave) {
        if (checked) {
          textarea.focus();
        }
        updateManualUi();
        return;
      }

      if (mode === "product") {
        if (!checked) {
          textarea.value = "";
          if (senderInput) senderInput.value = "";
          if (recipientInput) recipientInput.value = "";
        }
      }

      if (mode === "order" && !checked) {
        saveOrderMessage("", "", "", null);
        textarea.value = "";
        if (senderInput) senderInput.value = "";
        if (recipientInput) recipientInput.value = "";
      }

      if (mode === "order" && checked) {
        textarea.focus();
      }

      if (mode === "product") {
        syncProductProperties();
      }
    }

    toggle.addEventListener("change", handleToggleChange);
    toggle.addEventListener("input", handleToggleChange);
    toggle.addEventListener("click", function () {
      window.setTimeout(handleToggleChange, 0);
    });
    setPanelOpen(toggle.checked);

    if (mode === "product" && !toggle.checked) {
      textarea.disabled = true;
      if (senderInput) senderInput.disabled = true;
      if (recipientInput) recipientInput.disabled = true;
      if (messageIdInput) messageIdInput.disabled = true;
    }

    if (mode === "product") {
      loadCartToken(syncProductPropertiesFromCurrentForm);
      textarea.addEventListener("focus", loadCartToken);
      if (!manualSave) {
        textarea.addEventListener("input", syncProductPropertiesFromCurrentForm);
        if (senderInput)
          senderInput.addEventListener(
            "input",
            syncProductPropertiesFromCurrentForm,
          );
        if (recipientInput)
          recipientInput.addEventListener(
            "input",
            syncProductPropertiesFromCurrentForm,
          );
      }
      syncProductProperties();
      document.addEventListener("submit", handleProductSubmit, true);
      document.addEventListener(
        "pointerdown",
        handleProductCheckoutIntent,
        true,
      );
      document.addEventListener(
        "touchstart",
        handleProductCheckoutIntent,
        true,
      );
      document.addEventListener("click", handleProductCheckoutIntent, true);
    }

    if (manualSave) {
      textarea.addEventListener("input", markDirty);
      if (senderInput) senderInput.addEventListener("input", markDirty);
      if (recipientInput) recipientInput.addEventListener("input", markDirty);
      if (saveButton) {
        saveButton.addEventListener("click", saveCurrentMessage);
      }
      if (editButton) {
        editButton.addEventListener("click", function () {
          toggle.checked = true;
          setPanelOpen(true);
          textarea.focus();
          updateManualUi();
        });
      }
      removeButtons.forEach(function (button) {
        button.addEventListener("click", removeSavedMessage);
      });
      updateManualUi();
    }

    // ── Order mode: save through the App Proxy ───────────────────────────
    if (mode === "order" && !manualSave) {
      var saveTimer = null;

      var scheduleSave = function () {
        clearTimeout(saveTimer);
        setSaving("Saving…");
        saveTimer = setTimeout(function () {
          saveOrderMessage(
            getMessageValue(),
            getSenderValue(),
            getRecipientValue(),
            function () {
              setSaving("Saved ✓");
              setTimeout(function () {
                setSaving("");
              }, 2000);
            },
          );
        }, 600);
      };

      textarea.addEventListener("input", scheduleSave);
      if (senderInput) senderInput.addEventListener("input", scheduleSave);
      if (recipientInput)
        recipientInput.addEventListener("input", scheduleSave);

      textarea.addEventListener("blur", function () {
        clearTimeout(saveTimer);
        saveOrderMessage(
          getMessageValue(),
          getSenderValue(),
          getRecipientValue(),
          function () {
            setSaving("");
          },
        );
      });
      if (senderInput)
        senderInput.addEventListener("blur", function () {
          clearTimeout(saveTimer);
          saveOrderMessage(
            getMessageValue(),
            getSenderValue(),
            getRecipientValue(),
            function () {
              setSaving("");
            },
          );
        });
      if (recipientInput)
        recipientInput.addEventListener("blur", function () {
          clearTimeout(saveTimer);
          saveOrderMessage(
            getMessageValue(),
            getSenderValue(),
            getRecipientValue(),
            function () {
              setSaving("");
            },
          );
        });
    }

    function setSaving(text) {
      if (saving) saving.textContent = text;
    }

    function markDirty() {
      if (!manualSave) return;

      isDirty = true;
      hasSavedMessage = false;
      block.dataset.hasSavedMessage = "false";
      setSaving(hasAnyContent() ? "Unsaved" : "");

      if (mode === "product") {
        removeProductProperties(findProductForm());
      }

      updateManualUi();
    }

    function saveCurrentMessage() {
      if (!manualSave) return;

      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();

      if (!hasAnyContent()) {
        removeSavedMessage();
        return;
      }

      setManualButtonsBusy(true);
      setSaving("Saving...");

      if (mode === "product") {
        hasSavedMessage = true;
        isDirty = false;
        block.dataset.hasSavedMessage = "true";
        syncProductProperties();
        persistProductMessage(
          function () {
            finishManualSave();
          },
          function () {
            hasSavedMessage = false;
            isDirty = true;
            block.dataset.hasSavedMessage = "false";
            removeProductProperties(findProductForm());
            failManualSave();
          },
        );
        return;
      }

      loadCartToken(function () {
        saveOrderMessage(
          value,
          sender,
          recipient,
          function () {
            finishManualSave();
          },
          function () {
            failManualSave();
          },
        );
      });
    }

    function finishManualSave() {
      hasSavedMessage = true;
      isDirty = false;
      block.dataset.hasSavedMessage = "true";
      setSaving("Saved");
      setManualButtonsBusy(false);
      toggle.checked = false;
      setPanelOpen(false);
      updateManualUi();
      setTimeout(function () {
        if (!isDirty) setSaving("");
      }, 1800);
    }

    function failManualSave() {
      setManualButtonsBusy(false);
      setSaving("Could not save. Try again.");
      updateManualUi();
    }

    function removeSavedMessage() {
      if (!manualSave) return;

      setManualButtonsBusy(true);
      setSaving("Removing...");

      var currentMessageId = messageIdInput ? messageIdInput.value : "";
      textarea.value = "";
      if (senderInput) senderInput.value = "";
      if (recipientInput) recipientInput.value = "";
      updateCounter();

      if (mode === "product") {
        removeProductProperties(findProductForm());
        if (currentMessageId) {
          persistMessage(
            "",
            "",
            "",
            {
              cartToken: cartToken,
              cartReference: ensureCartReference(),
              messageId: currentMessageId,
              mode: "product",
              productId: productId,
              productTitle: productTitle,
              productHandle: productHandle,
              keepalive: true,
            },
            function () {
              finishRemoveSavedMessage();
            },
            function () {
              failManualSave();
            },
          );
        } else {
          finishRemoveSavedMessage();
        }
        return;
      }

      loadCartToken(function () {
        saveOrderMessage(
          "",
          "",
          "",
          function () {
            finishRemoveSavedMessage();
          },
          function () {
            failManualSave();
          },
        );
      });
    }

    function finishRemoveSavedMessage() {
      if (messageIdInput) messageIdInput.value = "";
      hasSavedMessage = false;
      isDirty = false;
      block.dataset.hasSavedMessage = "false";
      setSaving("Removed");
      setManualButtonsBusy(false);
      toggle.checked = false;
      setPanelOpen(false);
      updateManualUi();
      setTimeout(function () {
        if (!isDirty && !hasSavedMessage) setSaving("");
      }, 1600);
    }

    function updateManualUi() {
      if (!manualSave) return;

      var hasContent = hasAnyContent();
      var showSavedSummary = hasSavedMessage && !isDirty && !toggle.checked;

      if (savedSummary) savedSummary.hidden = !showSavedSummary;

      removeButtons.forEach(function (button) {
        button.hidden = !(hasSavedMessage || hasContent);
      });

      if (saveButton) {
        saveButton.disabled = !hasContent || (hasSavedMessage && !isDirty);
      }
    }

    function setManualButtonsBusy(busy) {
      if (saveButton) saveButton.disabled = busy;
      removeButtons.forEach(function (button) {
        button.disabled = busy;
      });
    }

    function hasAnyContent() {
      return Boolean(
        getMessageValue().trim() ||
          getSenderValue().trim() ||
          getRecipientValue().trim(),
      );
    }

    /**
     * Send the message to the App Proxy (/apps/gift-message).
     * Shopify proxies the request to the app backend, which verifies the HMAC,
     * persists the message in the DB, and returns { ok: true }.
     *
     * After the proxy confirms the save we also call /cart/update.js so the
     * cart attribute is updated for immediate display in the storefront.
     */
    function saveOrderMessage(value, sender, recipient, onSuccess, onError) {
      if (!cartToken) {
        // Fallback: update the cart attribute directly if we have no token.
        updateCartAttributes(value, sender, recipient, onSuccess, onError);
        return;
      }

      persistMessage(
        value,
        sender,
        recipient,
        {
          cartToken: cartToken,
          cartReference: ensureCartReference(),
          mode: mode,
        },
        function () {
          // Keep the Shopify cart attribute in sync for native cart display.
          updateCartAttributes(value, sender, recipient, onSuccess, onError);
        },
        function (err) {
          console.warn(
            "[GiftMessage] proxy error, falling back to cart update:",
            err,
          );
          // Graceful degradation: still update the cart attribute.
          updateCartAttributes(value, sender, recipient, onSuccess, onError);
        },
      );
    }

    function handleProductSubmit(event) {
      if (mode !== "product") return;

      var form = event && event.target ? event.target : findProductForm();
      if (!isProductForm(form)) return;

      syncProductProperties(form);
      persistProductMessage();
    }

    function handleProductCheckoutIntent(event) {
      if (mode !== "product") return;
      if (!isDynamicCheckoutTarget(event.target)) return;

      var now = Date.now();
      if (now - lastProductCheckoutIntentAt < 500) return;
      lastProductCheckoutIntentAt = now;

      var form = findProductFormForElement(event.target) || findProductForm();
      if (!isProductForm(form)) return;

      syncProductProperties(form);
      persistProductMessage();
    }

    function syncProductPropertiesFromCurrentForm() {
      syncProductProperties();
    }

    function syncProductProperties(form) {
      if (mode !== "product") return false;

      form = form || findProductForm();
      if (!isProductForm(form)) return false;

      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();
      var hasContent =
        shouldIncludeMessageInProductForm() &&
        Boolean(value.trim() || sender.trim() || recipient.trim());

      removeProductProperties(form);

      if (!lineItemPropertiesEnabled) return false;
      if (!hasContent) return false;
      if (manualSave && (!hasSavedMessage || isDirty)) return false;

      var messageId = ensureMessageId();

      addProductProperty(
        form,
        MESSAGE_PROPERTY,
        formatLineItemGiftMessage(sender, recipient, value),
      );
      addProductProperty(form, MESSAGE_REFERENCE_PROPERTY, messageId);

      return true;
    }

    function persistProductMessage(onSuccess, onError) {
      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();
      var hasContent =
        shouldIncludeMessageInProductForm() &&
        Boolean(value.trim() || sender.trim() || recipient.trim());

      if (!hasContent) return;
      if (manualSave && (!hasSavedMessage || isDirty)) return;

      var messageId = ensureMessageId();
      var variant = getSelectedVariant(findProductForm());

      persistMessage(value, sender, recipient, {
        cartToken: cartToken,
        cartReference: ensureCartReference(),
        messageId: messageId,
        mode: "product",
        productId: productId,
        productTitle: productTitle,
        productVariantTitle: getVariantTitle(variant),
        productSku: variant && variant.sku ? String(variant.sku) : "",
        productHandle: productHandle,
        keepalive: true,
      }, onSuccess, onError);
    }

    function isDynamicCheckoutTarget(target) {
      if (!target || typeof target.closest !== "function") return false;

      return Boolean(
        target.closest(
          [
            ".shopify-payment-button",
            "[data-shopify='payment-button']",
            "shopify-accelerated-checkout",
            "shopify-buy-it-now-button",
            "button[name='checkout']",
            "[name='checkout']",
            "a[href*='/checkout']",
          ].join(","),
        ),
      );
    }

    function findProductFormForElement(target) {
      if (!target || typeof target.closest !== "function") return null;

      var directForm = target.closest("form");
      if (isProductForm(directForm)) return directForm;

      var section = target.closest("[id^='shopify-section-']");
      if (section) {
        var sectionForm = section.querySelector("form[action*='/cart/add']");
        if (isProductForm(sectionForm)) return sectionForm;
      }

      return null;
    }

    function findProductForm() {
      if (textarea.form && isProductForm(textarea.form)) return textarea.form;

      var closestForm = block.closest("form");
      if (isProductForm(closestForm)) return closestForm;

      var section = block.closest("[id^='shopify-section-']");
      if (section) {
        var sectionForm = section.querySelector("form[action*='/cart/add']");
        if (isProductForm(sectionForm)) return sectionForm;
      }

      var addForm = document.querySelector("form[action*='/cart/add']");
      if (isProductForm(addForm)) return addForm;

      var variantInput = document.querySelector("form input[name='id']");
      return variantInput ? variantInput.form : null;
    }

    function isProductForm(form) {
      return Boolean(
        form &&
        form.tagName === "FORM" &&
        (String(form.getAttribute("action") || "").indexOf("/cart/add") !==
          -1 ||
          form.querySelector("input[name='id'], select[name='id']")),
      );
    }

    function addProductProperty(form, name, value) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[" + name + "]";
      input.value = value;
      input.setAttribute("data-gmb-property", "");
      form.appendChild(input);
    }

    function removeProductProperties(form) {
      if (!form) return;
      form.querySelectorAll("[data-gmb-property]").forEach(function (input) {
        input.remove();
      });
    }

    function shouldIncludeMessageInProductForm() {
      if (!manualSave) return toggle.checked;
      return hasSavedMessage && !isDirty;
    }

    function persistMessage(
      value,
      sender,
      recipient,
      options,
      onSuccess,
      onError,
    ) {
      options = options || {};

      fetch(PROXY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: Boolean(options.keepalive),
        body: JSON.stringify({
          message: value,
          sender: sender,
          recipient: recipient,
          cart_token: options.cartToken || "",
          cart_reference: options.cartReference || ensureCartReference(),
          message_id: options.messageId || "",
          mode: options.mode || mode,
          product_id: options.productId || "",
          product_title: options.productTitle || "",
          product_variant_title: options.productVariantTitle || "",
          product_sku: options.productSku || "",
          product_handle: options.productHandle || "",
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("proxy " + res.status);
          return res.json();
        })
        .then(function () {
          if (typeof onSuccess === "function") onSuccess();
        })
        .catch(function (err) {
          if (typeof onError === "function") {
            onError(err);
          } else {
            console.warn("[GiftMessage] proxy error:", err);
          }
        });
    }

    function updateCartAttributes(value, sender, recipient, onSuccess, onError) {
      var root =
        (window.Shopify &&
          window.Shopify.routes &&
          window.Shopify.routes.root) ||
        "/";
      fetch(root + "cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: {
            "Gift Message": value || sender || recipient
              ? formatLineItemGiftMessage(sender, recipient, value)
              : "",
            "Gift Message From": "",
            "Gift Message To": "",
            "Gift Message Ref": "",
            gift_message: "",
            gift_message_from: "",
            gift_message_to: "",
            gift_order_reference: "",
          },
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("cart/update " + res.status);
          if (typeof onSuccess === "function") onSuccess();
        })
        .catch(function (err) {
          console.warn("[GiftMessage]", err);
          setSaving("");
          if (typeof onError === "function") onError(err);
        });
    }

    function loadCartToken(callback) {
      if (cartToken) {
        if (typeof callback === "function") callback(cartToken);
        return;
      }

      var root =
        (window.Shopify &&
          window.Shopify.routes &&
          window.Shopify.routes.root) ||
        "/";
      fetch(root + "cart.js", { headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("cart.js " + res.status);
          return res.json();
        })
        .then(function (cart) {
          cartToken = cart && cart.token ? cart.token : "";
          block.dataset.cartToken = cartToken;
          cartReference = formatStableReference("GO", cartToken);
          if (typeof callback === "function") callback(cartToken);
        })
        .catch(function (err) {
          console.warn("[GiftMessage] cart token lookup failed:", err);
          if (typeof callback === "function") callback("");
        });
    }

    function ensureMessageId() {
      if (!messageIdInput) return "";
      if (!messageIdInput.value) {
        messageIdInput.value = createReference("GM");
      }
      messageIdInput.disabled = false;
      return messageIdInput.value;
    }

    function ensureCartReference() {
      if (cartReference) return cartReference;

      if (cartToken) {
        cartReference = formatStableReference("GO", cartToken);
        return cartReference;
      }

      cartReference = createReference("GO");
      return cartReference;
    }

    function getMessageValue() {
      return textarea ? textarea.value : "";
    }

    function getSenderValue() {
      return senderInput ? senderInput.value : "";
    }

    function getRecipientValue() {
      return recipientInput ? recipientInput.value : "";
    }

    function getProductVariants() {
      var variantsNode = block.querySelector(".gmb-variants-json");
      if (!variantsNode) return [];

      try {
        return JSON.parse(variantsNode.textContent || "[]") || [];
      } catch (err) {
        console.warn("[GiftMessage] product variant data parse failed:", err);
        return [];
      }
    }

    function getSelectedVariant(form) {
      if (!form) return null;

      var variantInput = form.querySelector(
        "input[name='id'], select[name='id']",
      );
      var variantId = variantInput ? String(variantInput.value || "") : "";

      if (!variantId) return null;

      return (
        productVariants.find(function (variant) {
          return String(variant.id || "") === variantId;
        }) || null
      );
    }

    function getVariantTitle(variant) {
      var title = variant && variant.title ? String(variant.title).trim() : "";
      return title && title.toLowerCase() !== "default title" ? title : "";
    }

    function formatLineItemGiftMessage(sender, recipient, message) {
      var lines = [];
      var cleanSender = String(sender || "").trim();
      var cleanRecipient = String(recipient || "").trim();
      var cleanMessage = String(message || "").trim();

      if (cleanSender) lines.push("From: " + cleanSender);
      if (cleanRecipient) lines.push("To: " + cleanRecipient);
      if (cleanMessage) lines.push("Message: " + cleanMessage);

      return lines.join("\n");
    }

    function createReference(prefix) {
      var code = "";

      if (
        window.crypto &&
        typeof window.crypto.getRandomValues === "function"
      ) {
        var values = new Uint32Array(REFERENCE_LENGTH);
        window.crypto.getRandomValues(values);
        for (var i = 0; i < values.length; i += 1) {
          code += REFERENCE_ALPHABET[values[i] % REFERENCE_ALPHABET.length];
        }
      } else {
        for (var j = 0; j < REFERENCE_LENGTH; j += 1) {
          code +=
            REFERENCE_ALPHABET[
              Math.floor(Math.random() * REFERENCE_ALPHABET.length)
            ];
        }
      }

      return prefix + "-" + code;
    }

    function formatStableReference(prefix, value) {
      var hash = 0;
      var cleanValue = String(value || "");

      for (var i = 0; i < cleanValue.length; i += 1) {
        hash = (hash * 31 + cleanValue.charCodeAt(i)) >>> 0;
      }

      var code = "";
      for (var j = 0; j < REFERENCE_LENGTH; j += 1) {
        code = REFERENCE_ALPHABET[hash % REFERENCE_ALPHABET.length] + code;
        hash = Math.floor(hash / REFERENCE_ALPHABET.length);
      }

      return prefix + "-" + code;
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────
  document.querySelectorAll("[data-gmb-block]").forEach(initBlock);

  document.addEventListener("shopify:section:load", function (event) {
    event.target.querySelectorAll("[data-gmb-block]").forEach(initBlock);
  });

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches("[data-gmb-block]")) {
            initBlock(node);
          } else {
            node.querySelectorAll("[data-gmb-block]").forEach(initBlock);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
