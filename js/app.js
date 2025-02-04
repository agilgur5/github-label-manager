/*
  github-label-manager is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  github-label-manager is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with github-label-manager.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

$(document).ready(function () {
  var targetUsername;
  var targetRepo;
  var targetOwner;
  var isLoadingShown = false;
  var loadingSemaphore = (function() {
    var count = 0;

    return {
      acquire : function() {
        console.log("acq " + count);
        ++count;
        return null;
      },
      release : function() {
        console.log("rel " + count);
        if(count <= 0){
          throw "Semaphore inconsistency";
        }

        --count;
        return null;
      },
      isLocked : function() {
        return count > 0;
      }
    };
  }());

  $.ajaxSetup({
    cache: false,
    complete: function(jqXHR, textStatus) {
      loadingSemaphore.release();
      if(isLoadingShown && loadingSemaphore.isLocked() === false){
        writeLog("All operations are done.");

        //add close button
        $('#loadingModal').append('<div class="modal-footer"><button class="btn" data-dismiss="modal" aria-hidden="true">Close');
      }
    },
    beforeSend: function(xhr) {
      var token = $('#githubToken').val().trim();
      loadingSemaphore.acquire();
      // only add authorization if a token is provided. Adding empty authorization header
      //fails loading for public repos
      if(token) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      }
    }
  });

  /**
  * username: github username <required>
  * mode:
  *       'list':
  *       'copy':
  * callback: as the name suggests...
  */
  function apiCallListLabels(username, repo, mode, callback) {
    apiCallListLabelsRecurse(username, repo, mode, 1, callback)
  }

  function apiCallListLabelsRecurse(username, repo, mode, page, callback) {
    apiCallListLabelsPage(username, repo, mode, page, function (response) {
      // error or empty array (no more labels)
      if (!response || response.status >= 400 || response.length === 0) {
        callback(response)
      } else {
        // recurse
        apiCallListLabelsRecurse(username, repo, mode, page + 1, callback)
      }
    })
  }

  function apiCallListLabelsPage(username, repo, mode, page, callback) {
    $.ajax({
      type: 'GET',
      url: 'https://api.github.com/repos/' + username + '/' + repo + '/labels?page=' + page,
      success: function (response) {
        console.log("success: ");
        console.log(response);

        if(response ){
          var labels = response;
          for (var i = labels.length - 1; i >= 0; i--) {
            var label = labels[i];
            console.log(label);

            label.color = label.color.toUpperCase();
            createNewLabelEntry(label, mode);

            //sets target indicator text
            $('#targetIndicator').html('Using <strong>' + targetOwner + "</strong>'s <strong>" + targetRepo + '</strong> as <strong>' + targetUsername + '</strong>');

          }//for
        }//if

        if(typeof callback == 'function'){
          callback(response);
        }
      },
      error: function(response) {
        if(response.status == 404) {
          alert('Not found! If this is a private repo make sure you provide a token.');
        }

        if(typeof callback == 'function'){
          callback(response);
        }
      }
    });
  }

  function apiCallCreateLabel(labelObject, callback) {

    $.ajax({
      type: "POST",
      url: 'https://api.github.com/repos/' + targetOwner + '/' + targetRepo + '/labels',
      data: JSON.stringify(labelObject),
      success: function (response) {
        console.log("success: ");
        console.log(response);
        if(typeof callback == 'function'){
          callback(response);
        }
        writeLog('Created label: ' + labelObject.name);
      },
      error: function(jqXHR, textStatus, errorThrown ) {
        writeLog('Creation of label failed for: ' + labelObject.name + ' Error: ' + errorThrown);
      }
    });
  }

  function apiCallUpdateLabel(labelObject, callback) {
    var originalName = labelObject.originalName;
    delete labelObject.originalName;

    $.ajax({
      type: "PATCH",
      url: 'https://api.github.com/repos/' + targetOwner + '/' + targetRepo + '/labels/' + originalName,
      data: JSON.stringify(labelObject),
      success: function (response) {
        console.log("success: ");
        console.log(response);
        if(typeof callback == 'function'){
          callback(response);
        }
        writeLog('Updated label: ' + originalName + ' => ' + labelObject.name);
      },
      error: function(jqXHR, textStatus, errorThrown ) {
        writeLog('Update of label failed for: ' + originalName + ' Error: ' + errorThrown);
      }
    });
  }

  function apiCallDeleteLabel(labelObject, callback) {
    $.ajax({
      type: "DELETE",
      url: 'https://api.github.com/repos/' + targetOwner + '/' + targetRepo + '/labels/' + labelObject.name,
      success: function (response) {
        console.log("success: ");
        console.log(response);
        if(typeof callback == 'function'){
          callback(response);
        }
        writeLog('Deleted label: ' + labelObject.name);
      },
      error: function(jqXHR, textStatus, errorThrown ) {
        writeLog('Deletion of label failed for: ' + labelObject.name + ' Error: ' + errorThrown);
      }
    });
  }

  function createNewLabelEntry(label, mode) {

    var action = ' action="none" ';
    var uncommitedSignClass = "";

    if(mode === 'copy' || mode === 'new'){
      action = ' action="create" new="true" ';
      uncommitedSignClass = ' uncommited ';
    }

    if(label === undefined || label === null){
      label = {
        name: "",
        description: "",
        color: ""
      };
    }

    label.description = label.description || "";

    var origNameVal = ' orig-val="' + label.name + '"';
    var origColorVal = ' orig-val="' + label.color + '"';
    var origDescriptionVal = ' orig-val="' + label.description + '"';

    var newElementEntry = $('\
      <div class="label-entry ' + uncommitedSignClass + '" ' + action + '>\
      <input name="name" type="text" class="input-small" placeholder="Name" value="' + label.name + '" ' + origNameVal + '>\
      <span class="sharp-sign">#</span>\
      <input name="color" type="text" class="input-small color-box" placeholder="Color"  value="' + label.color + '" ' + origColorVal + '>\
      <input name="description" type="text" class="input-medium" placeholder="Description"  value="' + label.description + '" ' + origDescriptionVal + '>\
      <button type="button" class="btn btn-danger delete-button">Delete</button>\
      </div>\
      ');

    newElementEntry.children().filter('.color-box').css('background-color', '#' + label.color);

    newElementEntry.children().filter(':input[orig-val]').change(function(e) {

      if($(this).val() == $(this).attr('orig-val')){//unchanged
        $(this).parent().attr('action', 'none');
        $(this).parent().removeClass('uncommited');
      }
      else{//changed
        if($(this).parent().attr('new') == 'true'){
          $(this).parent().attr('action', 'create');
        }
        else{
          $(this).parent().attr('action', 'update');
        }
        $(this).parent().addClass('uncommited');
      }

      checkIfAnyActionNeeded();
      return;
    });

    //Delete button
    newElementEntry.children().filter('.delete-button').click(function(e) {
      if(confirm('Really want to delete this?\n\nNote that this action only removes the label from this list not from Github.')){
        if($(this).parent().attr('new') == 'true'){
          $(this).parent().remove();
        }
        else{
          $(this).parent().prepend('<hr class="deleted">');
          $(this).siblings().attr('disabled', 'true');
          // $(this).attr('disabled', 'true');
          $(this).parent().attr('action', 'delete');
        }

        //add recover button
        var recoverButton = $('<a class="btn" href="#"><i class="icon-refresh"></i></a>');
        recoverButton.click(function() {
          debugger;
          //recover label-element's deleted state
          $(this).siblings().filter('hr').remove();
          $(this).siblings().removeAttr('disabled');
          if( $(this).siblings().filter('[name="name"]').attr('orig-val') == $(this).siblings().filter('[name="name"]').val() &&
              $(this).siblings().filter('[name="color"]').attr('orig-val') == $(this).siblings().filter('[name="color"]').val() ){

            $(this).parent().attr('action', 'none');
          }
          else{
            $(this).parent().attr('action', 'update');
          }
          $(this).remove();
          checkIfAnyActionNeeded();
        });//end recover button's click

        $(this).parent().append(recoverButton);

        checkIfAnyActionNeeded();
        return;
      }
    });

    //activate color picker on color-box field
    newElementEntry.children().filter('.color-box').ColorPicker({
      //http://www.eyecon.ro/colorpicker
      color: label.color,
      onSubmit: function(hsb, hex, rgb, el) {
        $(el).val(hex.toUpperCase());
        $(el).ColorPickerHide();
        $(el).css('background-color', '#' + hex);

        //-----------------------------
        //well here goes the copy-paste because normal binding to 'change' doesn't work
        // on newElementEntry.children().filter(':input[orig-val]').change(function...
        // since it is triggered programmatically
        if($(el).val() == $(el).attr('orig-val')){
          $(el).parent().attr('action', 'none');
          $(el).parent().removeClass('uncommited');
        }
        else{
          if($(el).parent().attr('new') == 'true'){
            $(el).parent().attr('action', 'create');
          }
          else{
            $(el).parent().attr('action', 'update');
          }
          $(el).parent().addClass('uncommited');
        }
        checkIfAnyActionNeeded();
        return;
        //-----------------------------
      },
      onBeforeShow: function () {
        $(this).ColorPickerSetColor(this.value);
      }
    })
.bind('keyup', function(){
  $(this).ColorPickerSetColor(this.value);
  $(this).css('background-color', '#' + this.value);
});

$('#labelsForm').append(newElementEntry);
}

$('#addNewLabelEntryButton').click(function(e) {
  createNewLabelEntry(null, 'new');
});

function clearAllLabels(){
  $('#labelsForm').text('');
  $('#commitButton').text('Commit changes');
  $('#commitButton').attr('disabled', 'disabled');
}

$('#listLabelsButton').click(function(e) {
  $(this).button('loading');
    var theButton = $(this);// dealing with closure
    targetOwner = $('#targetUrl').val().split(':')[0];
    targetRepo = $('#targetUrl').val().split(':')[1];
    targetUsername = $('#targetUsername').val();

    if(targetOwner && targetRepo){
      clearAllLabels();

      apiCallListLabels(targetOwner, targetRepo, 'list', function(response) {
        theButton.button('reset');
      });
    }
    else{
      alert("Please follow the format: \n\nusername:repo");
      theButton.button('reset');
    }
  });

$('#resetButton').click(function(e) {
  $(this).button('loading');
    var theButton = $(this);// dealing with closure
    clearAllLabels();
    apiCallListLabels(targetOwner, targetRepo, 'list', function(response) {
      theButton.button('reset');
    });
  });

$('#copyFromRepoButton').click(function(e) {
  $(this).button('loading');
    var theButton = $(this);// dealing with closure
    var username = $('#copyUrl').val().split(':')[0];
    var repo = $('#copyUrl').val().split(':')[1];

    if(username && repo){
      apiCallListLabels(username, repo, 'copy', function(response) {
        theButton.button('reset');
      });//set addUncommited to true because those are coming from another repo
    }
    else{
      alert("Please follow the format: \n\nusername:repo");
      theButton.button('reset');
    }
  });

$('#commitButton').click(function(e) {
  $(this).button('loading');
    var theButton = $(this);// dealing with closure
    var token = $('#githubToken').val();

    if(token.trim() == ''){
      alert('You need to enter your token for repo: ' + targetRepo + ' in order to commit labels.');
      theButton.button('reset');
      return;
    }


    commit();
  });

  //Enable popovers
  $('#targetUrl').popover({
    title: 'Example',
    content: '<code>github.com/destan/cevirgec</code> Then use <code>destan:cevirgec</code><br><em>Note that owner can also be an organization name.</em>',
    trigger: 'hover',
    html: true
  });

  $('#targetUsername').popover({
    title: "Why 'username' again?",
    content: "To let you modify a repo which belongs to another user or an organization. For example the repo maybe <code>my-organization:the-app</code> but username is <code>cylon</code>",
    trigger: "hover",
    html: true
  });

  $('#githubToken').popover({
    title: "My token is for what?",
    content: "The token is only required for committing. It won't be required until you try to commit something.",
    trigger: "hover",
    html: true
  });

  /**
  * Makes a label entry out of a div having the class .label-entry
  */
  function serializeLabel(jObjectLabelEntry) {
    return {
      name: jObjectLabelEntry.children().filter('[name="name"]').val(),
      description: jObjectLabelEntry.children().filter('[name="description"]').val().trim(),
      color: jObjectLabelEntry.children().filter('[name="color"]').val(),
      originalName: jObjectLabelEntry.children().filter('[name="name"]').attr('orig-val')
    };
  }

  /**
  * returns true if any change has been made and activates or disactivates commit button accordingly
  */
  function checkIfAnyActionNeeded() {
    var isNeeded = $('.label-entry:not([action="none"])').length > 0;

    if(isNeeded){
      $('#commitButton').removeAttr('disabled');
      $('#commitButton').removeClass('disabled');
    }
    else{
      $('#commitButton').attr('disabled', 'disabled');
    }

    return isNeeded;
  }

  function commit() {
    //TODO same name check

    //freeze the world
    $('#loadingModal').modal({
      keyboard: false,
      backdrop:'static'
    });

    //To be deleted
    $('.label-entry[action="delete"]').each(function(index) {
      var labelObject = serializeLabel($(this));
      apiCallDeleteLabel(labelObject);
    });

    //To be updated
    $('.label-entry[action="update"]').each(function(index) {
      var labelObject = serializeLabel($(this));
      apiCallUpdateLabel(labelObject);
    });

    //To be created
    $('.label-entry[action="create"]').each(function(index) {
      var labelObject = serializeLabel($(this));
      apiCallCreateLabel(labelObject);
    });
  }

  function writeLog(string) {
    $('#loadingModal > .modal-body').append(string + '<br>');
  }

  $('#loadingModal').on('hide', function () {
    isLoadingShown = false;

    //reset modal
    $('#loadingModal > .modal-body').text('');
    $('#loadingModal > .modal-body').append('<p>Commiting...');
    $('#loadingModal > .modal-footer').remove();

    //reload labels after changes
    clearAllLabels();
    apiCallListLabels(targetOwner, targetRepo, 'list');
  });

  $('#loadingModal').on('show', function () {
    isLoadingShown = true;
  });

}); //end of doc ready
